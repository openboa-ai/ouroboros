use anyhow::{Context, Result};
use axum::{Extension, Router};
use hyper_util::{rt::TokioIo, service::TowerToHyperService};
use rustls::{RootCertStore, ServerConfig, server::WebPkiClientVerifier};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{net::SocketAddr, path::PathBuf, sync::Arc, time::Duration};
use tokio::{net::TcpListener, sync::Semaphore};

pub mod config;
pub mod recovery;
mod shutdown;
#[cfg(target_os = "linux")]
mod socket_cleanup;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TlsFiles {
    pub certificate: PathBuf,
    pub private_key: config::SecretInput,
    pub ca: PathBuf,
}
impl TlsFiles {
    pub fn resolve_paths(&mut self, root: &config::ConfigRoot) -> Result<()> {
        root.resolve(&mut self.certificate)?;
        self.private_key.resolve(root)?;
        root.resolve(&mut self.ca)
    }
}
#[derive(Clone, Debug)]
pub struct Peer {
    pub fingerprint: String,
}
fn provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}
pub fn fingerprint(der: &[u8]) -> String {
    hex::encode(Sha256::digest(der))
}
pub fn client(files: &TlsFiles) -> Result<reqwest::Client> {
    provider();
    let mut identity = config::read_regular(&files.certificate, 1024 * 1024)?;
    identity.extend(files.private_key.read(1024 * 1024)?);
    Ok(reqwest::Client::builder()
        .https_only(true)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .tls_built_in_root_certs(false)
        .add_root_certificate(reqwest::Certificate::from_pem(&config::read_regular(
            &files.ca,
            1024 * 1024,
        )?)?)
        .identity(reqwest::Identity::from_pem(&identity)?)
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(65))
        .build()?)
}
fn tls_http1() -> hyper::server::conn::http1::Builder {
    let mut builder = hyper::server::conn::http1::Builder::new();
    // Each request gets its own bounded connection. Reusing a connection would
    // let an earlier request's deadline truncate a later model response.
    builder.keep_alive(false);
    builder
}

pub async fn serve(addr: SocketAddr, files: TlsFiles, app: Router) -> Result<()> {
    provider();
    let cert_bytes = config::read_regular(&files.certificate, 1024 * 1024)?;
    let certs = rustls_pemfile::certs(&mut cert_bytes.as_slice())
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let key_bytes = files.private_key.read(1024 * 1024)?;
    let key =
        rustls_pemfile::private_key(&mut key_bytes.as_slice())?.context("missing private key")?;
    let ca_bytes = config::read_regular(&files.ca, 1024 * 1024)?;
    let mut roots = RootCertStore::empty();
    for cert in rustls_pemfile::certs(&mut ca_bytes.as_slice()) {
        roots.add(cert?)?;
    }
    let verifier = WebPkiClientVerifier::builder(Arc::new(roots)).build()?;
    let config = ServerConfig::builder()
        .with_client_cert_verifier(verifier)
        .with_single_cert(certs, key)?;
    let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(config));
    let listener = TcpListener::bind(addr).await?;
    let permits = Arc::new(Semaphore::new(128));
    let (stop, _) = tokio::sync::watch::channel(false);
    let mut tasks = tokio::task::JoinSet::new();
    let signal = shutdown::signal();
    tokio::pin!(signal);
    loop {
        let (tcp, _) = tokio::select! {
            biased;
            result = &mut signal => { result?; break; },
            result = tasks.join_next(), if !tasks.is_empty() => { result.context("missing connection task")??; continue; },
            result = listener.accept() => result?,
        };
        let Ok(permit) = permits.clone().try_acquire_owned() else {
            drop(tcp);
            continue;
        };
        let acceptor = acceptor.clone();
        let app = app.clone();
        let mut stopping = stop.subscribe();
        tasks.spawn(async move {
            let _permit = permit;
            let Ok(Ok(tls)) =
                tokio::time::timeout(Duration::from_secs(5), acceptor.accept(tcp)).await
            else {
                return;
            };
            let Some(cert) = tls.get_ref().1.peer_certificates().and_then(|c| c.first()) else {
                return;
            };
            let peer = Peer {
                fingerprint: fingerprint(cert.as_ref()),
            };
            let service = TowerToHyperService::new(app.layer(Extension(peer)));
            // Bounded connection lifetime also forces periodic certificate revalidation.
            let connection = tls_http1().serve_connection(TokioIo::new(tls), service);
            tokio::pin!(connection);
            let _ = tokio::time::timeout(Duration::from_secs(60), async {
                tokio::select! {
                    result = &mut connection => { let _ = result; },
                    _ = stopping.changed() => {
                        connection.as_mut().graceful_shutdown();
                        let _ = connection.await;
                    }
                }
            })
            .await;
        });
    }
    drop(listener);
    shutdown::drain(&mut tasks, &stop, Duration::from_secs(5)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn tls_response_closes_connection_before_another_request_inherits_its_deadline() {
        let (mut client, server) = tokio::io::duplex(4096);
        let app = Router::new().route("/", axum::routing::get(|| async { "complete" }));
        let connection = tokio::spawn(async move {
            tls_http1()
                .serve_connection(TokioIo::new(server), TowerToHyperService::new(app))
                .await
                .unwrap();
        });
        client
            .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n")
            .await
            .unwrap();
        let mut response = Vec::new();
        tokio::time::timeout(Duration::from_secs(2), client.read_to_end(&mut response))
            .await
            .expect("response must close without waiting for the connection lifetime limit")
            .unwrap();
        let response = String::from_utf8(response).unwrap();
        assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(response.contains("connection: close\r\n"));
        assert!(response.ends_with("complete"));
        connection.await.unwrap();
    }
}

#[cfg(target_os = "linux")]
pub fn linux_peer(pid: i32, uid: u32) -> Result<ouroboros_contracts::BridgeIdentity> {
    anyhow::ensure!(pid > 0, "invalid peer PID");
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat"))?;
    let rest = stat.rsplit_once(')').context("invalid peer stat")?.1;
    // Fields after comm start at field 3; starttime is field 22.
    let ticks = rest
        .split_whitespace()
        .nth(19)
        .context("missing peer start time")?
        .parse()?;
    Ok(ouroboros_contracts::BridgeIdentity {
        pid,
        uid,
        start_ticks: ticks,
        boot_id: std::fs::read_to_string("/proc/sys/kernel/random/boot_id")?
            .trim()
            .into(),
    })
}
#[cfg(target_os = "linux")]
#[derive(Clone)]
pub struct InstancePeer {
    pub identity: ouroboros_contracts::BridgeIdentity,
    lifetime: Arc<std::os::fd::OwnedFd>,
}
#[cfg(target_os = "linux")]
impl InstancePeer {
    pub fn alive(&self) -> bool {
        use std::os::fd::AsRawFd;
        let mut p = libc::pollfd {
            fd: self.lifetime.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        };
        // A socket-derived pidfd identifies the original peer even after numeric PID reuse.
        // SAFETY: the pointer refers to the stated number of initialized pollfd records, alive for this call.
        (unsafe { libc::poll(&mut p, 1, 0) }) == 0
            && linux_peer(self.identity.pid, self.identity.uid)
                .ok()
                .as_ref()
                == Some(&self.identity)
    }
}
/// Gateway-only entry. Kernel identity is captured before any application request is read.
#[cfg(target_os = "linux")]
pub async fn serve_instance_socket(path: PathBuf, app: Router) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let parent = path.parent().context("socket parent required")?;
    let meta = std::fs::symlink_metadata(parent)?;
    anyhow::ensure!(
        meta.is_dir() && !meta.file_type().is_symlink() && meta.permissions().mode() & 0o022 == 0,
        "socket parent must be outer-owned"
    );
    // Never unlink an existing socket: another active Gateway may own it.
    let lease = socket_cleanup::SocketLease::acquire(&path)?;
    let listener = tokio::net::UnixListener::bind(&path)?;
    let owned_socket = socket_cleanup::OwnedSocket::capture(&path)?;
    lease.record(&owned_socket)?;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o666))?;
    let permits = Arc::new(Semaphore::new(64));
    let (stop, _) = tokio::sync::watch::channel(false);
    let mut tasks = tokio::task::JoinSet::new();
    let signal = shutdown::signal();
    tokio::pin!(signal);
    loop {
        let (socket, _) = tokio::select! {
            biased;
            result = &mut signal => { result?; break; },
            result = tasks.join_next(), if !tasks.is_empty() => { result.context("missing connection task")??; continue; },
            result = listener.accept() => result?,
        };
        let Ok(permit) = permits.clone().try_acquire_owned() else {
            continue;
        };
        let credential = socket.peer_cred()?;
        let Some(pid) = credential.pid() else {
            continue;
        };
        use std::os::fd::{AsRawFd, FromRawFd};
        let mut raw = -1_i32;
        let mut size = std::mem::size_of::<i32>() as libc::socklen_t;
        // SAFETY: the socket stays open and the value/length pointers refer to writable storage sized for this option.
        if unsafe {
            libc::getsockopt(
                socket.as_raw_fd(),
                libc::SOL_SOCKET,
                libc::SO_PEERPIDFD,
                (&mut raw as *mut i32).cast(),
                &mut size,
            )
        } != 0
            || raw < 0
        {
            continue;
        }
        // SAFETY: SO_PEERPIDFD succeeded and returned a new nonnegative descriptor; ownership transfers once.
        let lifetime = Arc::new(unsafe { std::os::fd::OwnedFd::from_raw_fd(raw) });
        let Ok(identity) = linux_peer(pid, credential.uid()) else {
            continue;
        };
        let peer = InstancePeer { identity, lifetime };
        if !peer.alive() {
            continue;
        }
        let app = app.clone();
        let mut stopping = stop.subscribe();
        tasks.spawn(async move {
            let _permit = permit;
            let service = TowerToHyperService::new(app.layer(Extension(peer)));
            let connection = hyper::server::conn::http1::Builder::new()
                .keep_alive(false)
                .timer(hyper_util::rt::TokioTimer::new())
                .header_read_timeout(Duration::from_secs(5))
                .serve_connection(TokioIo::new(socket), service);
            tokio::pin!(connection);
            // Model streams can outlive a short RPC. Bound header admission separately;
            // Gateway keeps checking current authority while the one response is delivered.
            let _ = tokio::time::timeout(Duration::from_secs(60), async {
                tokio::select! {
                    result = &mut connection => { let _ = result; },
                    _ = stopping.changed() => {
                        connection.as_mut().graceful_shutdown();
                        let _ = connection.await;
                    }
                }
            })
            .await;
        });
    }
    drop(listener);
    shutdown::drain(&mut tasks, &stop, Duration::from_secs(5)).await?;
    owned_socket.retire()
}

/// Local infrastructure maintenance only; never starts listeners or changes Core authority.
#[cfg(target_os = "linux")]
pub async fn recover_instance_socket(path: &std::path::Path) -> Result<()> {
    socket_cleanup::SocketLease::acquire(path)?
        .recover(path)
        .await
}

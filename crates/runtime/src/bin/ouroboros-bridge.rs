//! Trusted supervisor supplies the network-namespace FD and a private outer UDS path.
//! The workload receives neither. No PID/mount namespace is entered.
#[cfg(target_os = "linux")]
fn main() -> anyhow::Result<()> {
    use anyhow::ensure;
    use std::{path::PathBuf, sync::Arc};
    use tokio::{
        io::copy_bidirectional,
        net::{TcpListener, UnixStream},
        sync::Semaphore,
    };
    let args: Vec<_> = std::env::args().collect();
    ensure!(
        args.len() == 8,
        "usage: bridge NETNS_FD IPC_ROOT UPSTREAM_UDS UPSTREAM_UID UID GID PORT"
    );
    let fd: i32 = args[1].parse()?;
    let root = PathBuf::from(&args[2]);
    let upstream = PathBuf::from(&args[3]);
    let upstream_uid: u32 = args[4].parse()?;
    let uid: u32 = args[5].parse()?;
    let gid: u32 = args[6].parse()?;
    let port: u16 = args[7].parse()?;
    ensure!(
        fd >= 3 && uid >= 100000 && gid >= 100000 && port >= 1024 && upstream_uid != uid,
        "invalid isolated bridge parameters"
    );
    let upstream = Arc::new(ouroboros_runtime::socket::SocketBinding::capture(
        &root,
        &upstream,
        upstream_uid,
    )?);
    // SAFETY: called on the single-threaded launcher, with only the supervisor-supplied netns FD.
    ensure!(
        // SAFETY: the single-threaded launcher uses the inherited namespace descriptor before dropping privilege.
        unsafe { libc::setns(fd, libc::CLONE_NEWNET) } == 0,
        "cannot enter workload network namespace"
    );
    // SAFETY: this launcher owns the inherited descriptor and closes it once after its final use.
    unsafe {
        libc::close(fd);
    }
    ensure!(
        // SAFETY: a zero group count permits a null pointer; this launcher is still single-threaded.
        unsafe { libc::setgroups(0, std::ptr::null()) } == 0,
        "cannot clear groups"
    );
    ensure!(
        // SAFETY: both calls take scalar IDs only and run before any launcher threads are created.
        unsafe { libc::setgid(gid) } == 0 && unsafe { libc::setuid(uid) } == 0,
        "cannot drop bridge identity"
    );
    ensure!(
        // SAFETY: PR_SET_NO_NEW_PRIVS takes scalar arguments and only restricts this launcher.
        unsafe { libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) } == 0,
        "cannot prohibit privilege gain"
    );
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?
        .block_on(async move {
            upstream.probe().await?;
            let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await?;
            upstream.ready()?;
            println!("bridge_ready");
            let permits = Arc::new(Semaphore::new(16));
            let mut poll = tokio::time::interval(std::time::Duration::from_millis(200));
            loop {
                let accepted = tokio::select! {
                    result = listener.accept() => result?,
                    _ = poll.tick() => { upstream.ready()?; continue; }
                };
                let (mut client, _) = accepted;
                upstream.ready()?;
                let Ok(permit) = permits.clone().try_acquire_owned() else {
                    drop(client);
                    continue;
                };
                let upstream = upstream.clone();
                tokio::spawn(async move {
                    let _permit = permit;
                    if let Ok(mut server) = UnixStream::connect(upstream.address()).await {
                        if upstream.observe_peer(&server).is_err() {
                            return;
                        }
                        let _ = tokio::time::timeout(
                            std::time::Duration::from_secs(60),
                            copy_bidirectional(&mut client, &mut server),
                        )
                        .await;
                    }
                });
            }
            #[allow(unreachable_code)]
            Ok::<(), anyhow::Error>(())
        })
}
#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("bridge requires the qualified Linux backend");
    std::process::exit(78);
}

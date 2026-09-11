//! One fixed descriptor packet from trusted Runtime; no paths or reusable execution authority.
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use std::{
    fs::File,
    io::Write,
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::{
            fs::{FileExt, MetadataExt},
            net::UnixDatagram,
        },
    },
    time::{Duration, Instant},
};

pub fn send(socket: &UnixDatagram, files: [&File; 3]) -> Result<()> {
    let mut payload = *b"guard-fds";
    let mut iov = libc::iovec {
        iov_base: payload.as_mut_ptr().cast(),
        iov_len: payload.len(),
    };
    let mut control = [0usize; 8];
    // SAFETY: message pointers refer to live, aligned buffers for this synchronous call.
    unsafe {
        let mut msg: libc::msghdr = std::mem::zeroed();
        msg.msg_iov = &mut iov;
        msg.msg_iovlen = 1;
        msg.msg_control = control.as_mut_ptr().cast();
        msg.msg_controllen = libc::CMSG_SPACE(12) as usize;
        let cmsg = libc::CMSG_FIRSTHDR(&msg);
        (*cmsg).cmsg_level = libc::SOL_SOCKET;
        (*cmsg).cmsg_type = libc::SCM_RIGHTS;
        (*cmsg).cmsg_len = libc::CMSG_LEN(12) as usize;
        let fds = files.map(AsRawFd::as_raw_fd);
        std::ptr::copy_nonoverlapping(fds.as_ptr(), libc::CMSG_DATA(cmsg).cast::<i32>(), 3);
        ensure!(
            libc::sendmsg(socket.as_raw_fd(), &msg, libc::MSG_NOSIGNAL) == payload.len() as isize,
            "guard descriptor handoff failed"
        );
    }
    Ok(())
}

pub fn receive(socket: &UnixDatagram) -> Result<[File; 3]> {
    socket.set_read_timeout(Some(Duration::from_secs(3)))?;
    let mut peer: libc::ucred = unsafe { std::mem::zeroed() };
    let mut length = std::mem::size_of_val(&peer) as libc::socklen_t;
    ensure!(
        unsafe {
            libc::getsockopt(
                socket.as_raw_fd(),
                libc::SOL_SOCKET,
                libc::SO_PEERCRED,
                (&mut peer as *mut libc::ucred).cast(),
                &mut length,
            )
        } == 0
            && peer.uid == 0
            && peer.pid > 0,
        "trusted Runtime descriptor sender required"
    );
    let mut payload = [0u8; 16];
    let mut control = [0usize; 8];
    let mut files = Vec::new();
    let mut iov = libc::iovec {
        iov_base: payload.as_mut_ptr().cast(),
        iov_len: payload.len(),
    };
    // SAFETY: kernel-validated SCM_RIGHTS descriptors are each immediately given an owner.
    unsafe {
        let mut msg: libc::msghdr = std::mem::zeroed();
        msg.msg_iov = &mut iov;
        msg.msg_iovlen = 1;
        msg.msg_control = control.as_mut_ptr().cast();
        msg.msg_controllen = std::mem::size_of_val(&control);
        let count = libc::recvmsg(socket.as_raw_fd(), &mut msg, libc::MSG_CMSG_CLOEXEC);
        ensure!(count >= 0, "guard descriptor receive failed");
        let mut cmsg = libc::CMSG_FIRSTHDR(&msg);
        while !cmsg.is_null() {
            if (*cmsg).cmsg_level == libc::SOL_SOCKET && (*cmsg).cmsg_type == libc::SCM_RIGHTS {
                let number =
                    ((*cmsg).cmsg_len - libc::CMSG_LEN(0) as usize) / std::mem::size_of::<i32>();
                for i in 0..number {
                    files.push(File::from_raw_fd(
                        *libc::CMSG_DATA(cmsg).cast::<i32>().add(i),
                    ));
                }
            }
            cmsg = libc::CMSG_NXTHDR(&msg, cmsg);
        }
        ensure!(
            msg.msg_flags & (libc::MSG_TRUNC | libc::MSG_CTRUNC) == 0
                && count == 9
                && &payload[..9] == b"guard-fds"
                && files.len() == 3,
            "invalid guard descriptor inventory"
        );
    }
    files
        .try_into()
        .map_err(|_| anyhow::anyhow!("guard descriptor inventory changed"))
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Closure {
    pub deadline_boottime_ns: u64,
    pub events_device: u64,
    pub events_inode: u64,
    pub state: ouroboros_contracts::AllocationClosure,
}

pub struct DeadlineWait {
    timer: File,
    signal: File,
}
impl DeadlineWait {
    pub fn new(deadline: u64) -> Result<Self> {
        let mut mask: libc::sigset_t = unsafe { std::mem::zeroed() };
        unsafe {
            libc::sigemptyset(&mut mask);
            libc::sigaddset(&mut mask, libc::SIGUSR1);
        }
        ensure!(
            unsafe { libc::sigprocmask(libc::SIG_BLOCK, &mask, std::ptr::null_mut()) } == 0,
            "cannot block early-stop signal"
        );
        let fd = unsafe { libc::signalfd(-1, &mask, libc::SFD_CLOEXEC | libc::SFD_NONBLOCK) };
        ensure!(fd >= 0, "cannot create early-stop signal handle");
        let signal = unsafe { File::from_raw_fd(fd) };
        let fd = unsafe {
            libc::timerfd_create(libc::CLOCK_BOOTTIME, libc::TFD_CLOEXEC | libc::TFD_NONBLOCK)
        };
        ensure!(fd >= 0, "cannot create independent deadline timer");
        let timer = unsafe { File::from_raw_fd(fd) };
        let mut when: libc::itimerspec = unsafe { std::mem::zeroed() };
        when.it_value.tv_sec = (deadline / 1_000_000_000) as libc::time_t;
        when.it_value.tv_nsec = (deadline % 1_000_000_000) as libc::c_long;
        ensure!(
            unsafe {
                libc::timerfd_settime(
                    timer.as_raw_fd(),
                    libc::TFD_TIMER_ABSTIME,
                    &when,
                    std::ptr::null_mut(),
                )
            } == 0,
            "cannot arm immutable deadline"
        );
        Ok(Self { timer, signal })
    }
    pub fn wait(self) -> Result<()> {
        loop {
            let mut descriptors = [
                libc::pollfd {
                    fd: self.timer.as_raw_fd(),
                    events: libc::POLLIN,
                    revents: 0,
                },
                libc::pollfd {
                    fd: self.signal.as_raw_fd(),
                    events: libc::POLLIN,
                    revents: 0,
                },
            ];
            let count = unsafe { libc::poll(descriptors.as_mut_ptr(), 2, -1) };
            if count < 0 {
                let error = std::io::Error::last_os_error();
                if error.kind() == std::io::ErrorKind::Interrupted {
                    continue;
                }
                return Err(error.into());
            }
            ensure!(
                descriptors
                    .iter()
                    .all(|d| d.revents & (libc::POLLERR | libc::POLLNVAL | libc::POLLHUP) == 0),
                "guard wait handle failed"
            );
            if descriptors[0].revents & libc::POLLIN != 0 {
                return Ok(());
            }
            if descriptors[1].revents & libc::POLLIN != 0 {
                let mut info: libc::signalfd_siginfo = unsafe { std::mem::zeroed() };
                let read = unsafe {
                    libc::read(
                        self.signal.as_raw_fd(),
                        (&mut info as *mut libc::signalfd_siginfo).cast(),
                        std::mem::size_of_val(&info),
                    )
                };
                ensure!(
                    read == std::mem::size_of_val(&info) as isize,
                    "invalid early-stop event"
                );
                if info.ssi_signo == libc::SIGUSR1 as u32 && info.ssi_uid == 0 {
                    return Ok(());
                }
            }
        }
    }
}

fn population(events: &File) -> Result<Option<ouroboros_contracts::AllocationClosure>> {
    let mut bytes = [0u8; 4096];
    let length = match events.read_at(&mut bytes, 0) {
        Ok(n) => n,
        Err(e) if e.raw_os_error() == Some(libc::ENODEV) => {
            return Ok(Some(ouroboros_contracts::AllocationClosure::Deactivated));
        }
        Err(e) => return Err(e.into()),
    };
    ensure!(length < bytes.len(), "oversized cgroup events");
    let lines: Vec<_> = std::str::from_utf8(&bytes[..length])?
        .lines()
        .filter(|line| line.starts_with("populated "))
        .collect();
    ensure!(lines.len() == 1, "ambiguous cgroup population");
    match lines[0] {
        "populated 0" => Ok(Some(ouroboros_contracts::AllocationClosure::Empty)),
        "populated 1" => Ok(None),
        _ => anyhow::bail!("invalid cgroup population"),
    }
}

pub fn validate(files: &[File; 3]) -> Result<()> {
    for (file, access) in [(&files[0], libc::O_WRONLY), (&files[1], libc::O_RDONLY)] {
        let mut fs: libc::statfs = unsafe { std::mem::zeroed() };
        ensure!(
            unsafe { libc::fstatfs(file.as_raw_fd(), &mut fs) } == 0
                && fs.f_type == libc::CGROUP2_SUPER_MAGIC,
            "guard cgroup descriptor required"
        );
        ensure!(
            unsafe { libc::fcntl(file.as_raw_fd(), libc::F_GETFL) } & libc::O_ACCMODE == access,
            "guard descriptor access mismatch"
        );
    }
    let output = files[2].metadata()?;
    ensure!(
        output.is_file()
            && output.uid() == 0
            && output.nlink() == 1
            && output.mode() & 0o077 == 0
            && output.len() == 0,
        "fresh protected guard receipt required"
    );
    ensure!(
        unsafe { libc::fcntl(files[2].as_raw_fd(), libc::F_GETFL) } & libc::O_ACCMODE
            == libc::O_WRONLY,
        "guard receipt must be write-only"
    );
    ensure!(
        population(&files[1])?.is_none(),
        "guard must observe its original live cgroup before arming"
    );
    Ok(())
}

pub fn persist_closure(events: &File, mut receipt: &File, deadline: u64) -> Result<()> {
    let stop = Instant::now() + Duration::from_secs(3);
    let state = loop {
        if let Some(state) = population(events)? {
            break state;
        }
        ensure!(Instant::now() < stop, "guard closure remains unresolved");
        std::thread::sleep(Duration::from_millis(10));
    };
    let meta = events.metadata()?;
    let mut bytes = serde_json::to_vec(&Closure {
        deadline_boottime_ns: deadline,
        events_device: meta.dev(),
        events_inode: meta.ino(),
        state,
    })?;
    bytes.push(b'\n');
    receipt.write_all(&bytes)?;
    receipt.sync_all()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires root in the dedicated Linux guest to test the trusted sender"]
    fn descriptor_packet_preserves_handles_and_rejects_unbacked_input() {
        assert_eq!(unsafe { libc::geteuid() }, 0);
        let (sender, receiver) = UnixDatagram::pair().unwrap();
        let files = [
            File::open("/dev/null").unwrap(),
            File::open("/dev/zero").unwrap(),
            File::open("/dev/null").unwrap(),
        ];
        send(&sender, [&files[0], &files[1], &files[2]]).unwrap();
        let received = receive(&receiver).unwrap();
        for (source, received) in files.iter().zip(received.iter()) {
            assert_eq!(
                source.metadata().unwrap().rdev(),
                received.metadata().unwrap().rdev()
            );
            assert_ne!(source.as_raw_fd(), received.as_raw_fd());
            assert_ne!(
                unsafe { libc::fcntl(received.as_raw_fd(), libc::F_GETFD) } & libc::FD_CLOEXEC,
                0
            );
        }
        assert!(validate(&received).is_err());
        sender.send(b"guard-fds").unwrap();
        assert!(receive(&receiver).is_err());
    }
}

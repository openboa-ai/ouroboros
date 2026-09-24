//! Inherited fixed-target FD only: this process never opens a cgroup or Docker socket.
#[cfg(target_os = "linux")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use std::io::Write;
    use std::os::fd::{AsRawFd, FromRawFd};
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 3 {
        return Err("usage: ouroboros-guard KILL_FD DEADLINE_BOOTTIME_NS".into());
    }
    let handles = if args[1] == "--receive" {
        // SAFETY: the --receive launcher contract transfers sole ownership of its inherited socket on fd 0; this process does not use stdin.
        let socket = unsafe { std::os::unix::net::UnixDatagram::from_raw_fd(0) };
        let files = ouroboros_runtime::guard_handoff::receive(&socket)?;
        ouroboros_runtime::guard_handoff::validate(&files)?;
        Some(files)
    } else {
        None
    };
    let fd: i32 = if let Some(files) = &handles {
        files[0].as_raw_fd()
    } else {
        args[1].parse()?
    };
    let deadline: i64 = args[2].parse()?;
    // A managed guard can receive the fixed write-only handle as stdin via
    // systemd's descriptor-preserving --pipe transport. stdout/stderr are never targets.
    if fd < 0 || fd == 1 || fd == 2 || deadline <= 0 {
        return Err("invalid fixed target or deadline".into());
    }
    // SAFETY: this libc record contains only integers and fixed arrays; all-zero bits are valid.
    let mut fs: libc::statfs = unsafe { std::mem::zeroed() };
    // SAFETY: fd is inherited; statfs writes into a correctly sized live object.
    if unsafe { libc::fstatfs(fd, &mut fs) } != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    if fs.f_type != libc::CGROUP2_SUPER_MAGIC {
        return Err("kill FD is not on cgroup v2".into());
    }
    // SAFETY: F_GETFL/F_GETFD take no pointer argument and do not transfer descriptor ownership.
    if unsafe { libc::fcntl(fd, libc::F_GETFL) } & libc::O_ACCMODE != libc::O_WRONLY {
        return Err("kill FD must be write-only".into());
    }
    let mut now = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    // SAFETY: the output points to a live writable timespec; clock_gettime does not retain it.
    if unsafe { libc::clock_gettime(libc::CLOCK_BOOTTIME, &mut now) } != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    let current = now
        .tv_sec
        .checked_mul(1_000_000_000)
        .and_then(|v| v.checked_add(now.tv_nsec))
        .ok_or("clock overflow")?;
    if deadline <= current {
        return Err("deadline already elapsed; supervisor must contain immediately".into());
    }
    let when = libc::timespec {
        tv_sec: deadline / 1_000_000_000,
        tv_nsec: deadline % 1_000_000_000,
    };
    let wait = if handles.is_some() {
        Some(ouroboros_runtime::guard_handoff::DeadlineWait::new(
            deadline as u64,
        )?)
    } else {
        None
    };
    println!("armed {deadline}");
    std::io::stdout().flush()?;
    if let Some(wait) = wait {
        wait.wait()?;
    } else {
        loop {
            // Absolute BOOTTIME deadline is unchanged by signals or supervisor EOF.
            // SAFETY: when is an initialized timespec borrowed for the call; no remainder output is requested.
            let status = unsafe {
                libc::clock_nanosleep(
                    libc::CLOCK_BOOTTIME,
                    libc::TIMER_ABSTIME,
                    &when,
                    std::ptr::null_mut(),
                )
            };
            if status == 0 {
                break;
            }
            if status != libc::EINTR {
                return Err(std::io::Error::from_raw_os_error(status).into());
            }
        }
    }
    // SAFETY: the static byte buffer contains the one byte requested; the kernel validates fd.
    let written = unsafe { libc::write(fd, b"1".as_ptr().cast(), 1) } == 1;
    if let Some(files) = &handles {
        ouroboros_runtime::guard_handoff::persist_closure(&files[1], &files[2], deadline as u64)?;
    } else if !written {
        return Err(std::io::Error::last_os_error().into());
    }
    if written {
        println!("kill_written");
    } else {
        println!("target_closure_observed");
    }
    Ok(())
}
#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("guard requires the qualified Linux cgroup v2 backend");
    std::process::exit(78);
}

//! Fixture-image-only TCP checks; never used as a product authorization decision.
use std::{
    net::{Ipv4Addr, SocketAddr, TcpStream},
    time::Duration,
};

fn main() {
    let ports: Vec<u16> = std::env::args()
        .skip(1)
        .map(|p| p.parse().expect("numeric port"))
        .collect();
    assert_eq!(ports.len(), 2, "gateway port and database port required");
    assert!(ports.iter().all(|p| *p > 0) && ports[0] != ports[1]);
    TcpStream::connect_timeout(
        &SocketAddr::from((Ipv4Addr::LOCALHOST, ports[0])),
        Duration::from_secs(2),
    )
    .expect("Gateway positive control must connect");
    for (name, ip, port, allowed) in [
        (
            "metadata",
            Ipv4Addr::new(169, 254, 169, 254),
            80,
            &[101, 113][..],
        ),
        ("external", Ipv4Addr::new(1, 1, 1, 1), 80, &[101, 113][..]),
        ("database", Ipv4Addr::LOCALHOST, ports[1], &[111][..]),
    ] {
        let error =
            TcpStream::connect_timeout(&SocketAddr::from((ip, port)), Duration::from_secs(2))
                .expect_err("private workload reached a forbidden TCP endpoint");
        let errno = error
            .raw_os_error()
            .expect("timeout or unknown failure is not proof of isolation");
        assert!(
            allowed.contains(&errno),
            "unexpected {name} connect error: {error}"
        );
        println!("OUROBOROS_TCP_DENIED {name} errno={errno}");
    }
    println!("OUROBOROS_DIRECT_ACCESS_DENIED");
}

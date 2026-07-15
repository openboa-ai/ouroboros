#!/usr/bin/env python3
import argparse
import json
import socket
import subprocess
import sys
import urllib.request


PROTOCOL_VERSION = "candidate-network-egress-probe/v1"
DENIED_PROBE_NAMES = (
    "direct_https",
    "redirect_to_public_https",
    "dns_resolution",
    "raw_tcp",
    "raw_udp_dns",
    "subprocess_curl",
    "child_process_http",
    "cloud_metadata",
    "private_network",
    "alternate_host_port",
)


class ProbeUnavailable(Exception):
    pass


def request(url):
    with urllib.request.urlopen(url, timeout=3) as response:
        response.read(4096)


def dns_resolution():
    program = "import socket; socket.getaddrinfo('example.com', 443)"
    result = subprocess.run(
        [sys.executable, "-c", program],
        capture_output=True,
        check=False,
        timeout=4,
    )
    if result.returncode == 0:
        return
    raise OSError("dns_exit_{}".format(result.returncode))


def raw_tcp():
    query = (
        b"\x12\x34\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00"
        b"\x07example\x03com\x00\x00\x01\x00\x01"
    )
    with socket.create_connection(("1.1.1.1", 53), timeout=3) as client:
        client.settimeout(3)
        client.sendall(len(query).to_bytes(2, "big") + query)
        response_length = client.recv(2)
        if len(response_length) != 2:
            raise OSError("tcp_dns_response_missing")
        remaining = int.from_bytes(response_length, "big")
        response = b""
        while len(response) < remaining:
            chunk = client.recv(remaining - len(response))
            if not chunk:
                raise OSError("tcp_dns_response_truncated")
            response += chunk


def raw_udp_dns():
    query = (
        b"\x12\x34\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00"
        b"\x07example\x03com\x00\x00\x01\x00\x01"
    )
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
        client.settimeout(3)
        client.sendto(query, ("8.8.8.8", 53))
        client.recvfrom(512)


def subprocess_curl():
    try:
        result = subprocess.run(
            ["curl", "-fsS", "--max-time", "3", "https://example.com/"],
            capture_output=True,
            check=False,
            timeout=4,
        )
    except FileNotFoundError as error:
        raise ProbeUnavailable("curl_not_installed") from error
    if result.returncode == 0:
        return
    raise OSError("curl_exit_{}".format(result.returncode))


def child_process_http():
    program = (
        "import urllib.request; "
        "urllib.request.urlopen('https://example.com/', timeout=3).read(1)"
    )
    result = subprocess.run(
        [sys.executable, "-c", program],
        capture_output=True,
        check=False,
        timeout=4,
    )
    if result.returncode == 0:
        return
    raise OSError("child_exit_{}".format(result.returncode))


def observe_denied(name, operation):
    try:
        operation()
        return {
            "name": name,
            "expected": "denied",
            "observed": "allowed",
            "detail": "forbidden_route_succeeded",
        }
    except ProbeUnavailable as error:
        return {
            "name": name,
            "expected": "denied",
            "observed": "unavailable",
            "detail": str(error),
        }
    except Exception as error:
        return {
            "name": name,
            "expected": "denied",
            "observed": "denied",
            "detail": type(error).__name__,
        }


def observe_gateway(url, expected_body):
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            body = response.read(4096).decode("utf-8")
            allowed = response.status == 200 and body == expected_body
            return {
                "expected": "allowed",
                "observed": "allowed" if allowed else "invalid_response",
            }
    except Exception as error:
        return {
            "expected": "allowed",
            "observed": "denied",
            "detail": type(error).__name__,
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gateway-url", required=True)
    parser.add_argument("--expected-gateway-body", required=True)
    parser.add_argument("--alternate-host-url", required=True)
    args = parser.parse_args()

    gateway_url = args.gateway_url.rstrip("/") + "/"
    probes = [
        observe_denied("direct_https", lambda: request("https://example.com/")),
        observe_denied(
            "redirect_to_public_https",
            lambda: request(gateway_url + "redirect"),
        ),
        observe_denied("dns_resolution", dns_resolution),
        observe_denied("raw_tcp", raw_tcp),
        observe_denied("raw_udp_dns", raw_udp_dns),
        observe_denied("subprocess_curl", subprocess_curl),
        observe_denied("child_process_http", child_process_http),
        observe_denied(
            "cloud_metadata",
            lambda: request("http://169.254.169.254/latest/meta-data/"),
        ),
        observe_denied("private_network", lambda: request("http://10.0.0.1/")),
        observe_denied(
            "alternate_host_port",
            lambda: request(args.alternate_host_url),
        ),
    ]
    gateway = observe_gateway(gateway_url, args.expected_gateway_body)
    passed = (
        gateway["observed"] == "allowed"
        and tuple(item["name"] for item in probes) == DENIED_PROBE_NAMES
        and all(item["observed"] == "denied" for item in probes)
    )
    print(
        json.dumps(
            {
                "protocol_version": PROTOCOL_VERSION,
                "gateway": gateway,
                "probes": probes,
                "passed": passed,
            },
            separators=(",", ":"),
        )
    )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

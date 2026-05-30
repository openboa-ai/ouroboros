#!/usr/bin/env python3
"""Minimal opaque TradingSystem artifact fixture.

The fixture exposes only runtime-boundary output: order request, heartbeat,
and log lines.
It intentionally contains no trading strategy schema, credentials, network
access, provider calls, or exchange gateway behavior.
"""

from __future__ import annotations

import argparse
import json
import signal
import sys
import time
from pathlib import Path


STOP_REQUESTED = False


def request_stop(_signum: int, _frame: object) -> None:
    global STOP_REQUESTED
    STOP_REQUESTED = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Opaque clock runtime fixture")
    parser.add_argument("--instance-id", required=True)
    parser.add_argument("--ticks", type=int, default=0)
    parser.add_argument("--interval-ms", type=int, default=1000)
    parser.add_argument("--log-file")
    parser.add_argument("--heartbeat-file")
    parser.add_argument("--start-at", default="1970-01-01T00:00:00.000Z")
    parser.add_argument(
        "--paper-order-request",
        choices=("valid", "rejected"),
        default="valid",
    )
    args = parser.parse_args()

    if args.ticks < 0:
        parser.error("--ticks must be >= 0")
    if args.interval_ms < 0:
        parser.error("--interval-ms must be >= 0")
    return args


def emit(line: str, log_path: Path | None, heartbeat_path: Path | None) -> None:
    print(line, flush=True)
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(f"{line}\n")
    if heartbeat_path is not None:
        heartbeat_path.parent.mkdir(parents=True, exist_ok=True)
        heartbeat_path.write_text(f"{line}\n", encoding="utf-8")


def main() -> int:
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    args = parse_args()

    log_path = Path(args.log_file) if args.log_file else None
    heartbeat_path = Path(args.heartbeat_file) if args.heartbeat_file else None
    tick = 0

    order_request_payload = {
        "event": "order_request",
        "event_id": f"{args.instance_id}:order-request:0001",
        "instance_id": args.instance_id,
        "symbol": "BTCUSDT",
        "intent_kind": "place_order",
        "side": "buy",
        "order_type": "limit",
        "quantity": "0" if args.paper_order_request == "rejected" else "0.001",
        "limit_price": "60000",
        "authority_status": "trace_only",
        "at": args.start_at,
    }
    emit(json.dumps(order_request_payload, sort_keys=True), log_path, heartbeat_path)

    while not STOP_REQUESTED:
        tick += 1
        payload = {
            "event": "runtime_heartbeat",
            "instance_id": args.instance_id,
            "tick": tick,
            "at": args.start_at,
        }
        emit(json.dumps(payload, sort_keys=True), log_path, heartbeat_path)

        if args.ticks and tick >= args.ticks:
            break

        time.sleep(args.interval_ms / 1000)

    shutdown_payload = {
        "event": "runtime_stopped",
        "instance_id": args.instance_id,
        "tick": tick,
        "at": args.start_at,
    }
    emit(json.dumps(shutdown_payload, sort_keys=True), log_path, heartbeat_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())

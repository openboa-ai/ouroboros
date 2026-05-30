#!/usr/bin/env python3
"""Minimal paper TradingSystem sample.

This sample does not call Binance, providers, credentials, or the Gateway. It
only emits the paper event protocol that Ouroboros consumes from sandbox logs.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Paper TradingSystem smoke sample")
    parser.add_argument("--instance-id", required=True)
    parser.add_argument("--ticks", type=int, default=2)
    parser.add_argument("--interval-ms", type=int, default=1000)
    parser.add_argument("--log-file")
    parser.add_argument("--start-at", default="1970-01-01T00:00:00.000Z")
    parser.add_argument("--order-type", choices=("limit", "market"), default="limit")
    parser.add_argument("--cancel-after-order", action="store_true")
    args = parser.parse_args()
    if args.ticks < 0:
        parser.error("--ticks must be >= 0")
    if args.interval_ms < 0:
        parser.error("--interval-ms must be >= 0")
    return args


def emit(payload: dict[str, object], log_path: Path | None) -> None:
    line = json.dumps(payload, sort_keys=True)
    print(line, flush=True)
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{line}\n")


def order_event(args: argparse.Namespace) -> dict[str, object]:
    payload: dict[str, object] = {
        "event": "order_request",
        "event_id": f"{args.instance_id}:order-request:0001",
        "instance_id": args.instance_id,
        "at": args.start_at,
        "authority_status": "trace_only",
        "intent_kind": "place_order",
        "symbol": "BTCUSDT",
        "side": "buy",
        "order_type": args.order_type,
        "quantity": "0.001",
        "reason": "paper smoke sample emits one bounded BTCUSDT order",
    }
    if args.order_type == "limit":
        payload["limit_price"] = "60000"
    return payload


def cancel_event(args: argparse.Namespace) -> dict[str, object]:
    return {
        "event": "cancel_order",
        "event_id": f"{args.instance_id}:cancel-order:0001",
        "instance_id": args.instance_id,
        "at": args.start_at,
        "authority_status": "trace_only",
        "reason": "paper smoke sample cancels remaining fake quantity",
    }


def hold_event(args: argparse.Namespace, tick: int) -> dict[str, object]:
    return {
        "event": "hold",
        "event_id": f"{args.instance_id}:hold:{tick:04d}",
        "instance_id": args.instance_id,
        "at": args.start_at,
        "authority_status": "trace_only",
        "reason": "paper smoke sample has no fresh order",
    }


def main() -> int:
    args = parse_args()
    log_path = Path(args.log_file) if args.log_file else None
    emit(order_event(args), log_path)
    if args.cancel_after_order:
        emit(cancel_event(args), log_path)
    for tick in range(1, args.ticks + 1):
        emit(hold_event(args, tick), log_path)
        if tick < args.ticks:
            time.sleep(args.interval_ms / 1000)
    return 0


if __name__ == "__main__":
    sys.exit(main())

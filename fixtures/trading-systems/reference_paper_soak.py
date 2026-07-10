#!/usr/bin/env python3
"""Reference paper TradingSystem.

This system is intentionally small but it behaves like a running trading
system: it owns its cadence, reads only the injected Ouroboros paper runtime
API, emits bounded paper events, and never imports Binance or credentials.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import error, request


STOP_REQUESTED = False


def request_stop(_signum: int, _frame: object) -> None:
    global STOP_REQUESTED
    STOP_REQUESTED = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reference paper TradingSystem")
    parser.add_argument("--instance-id", required=True)
    parser.add_argument("--ticks", type=int, default=0)
    parser.add_argument("--interval-ms", type=int, default=1000)
    parser.add_argument("--log-file")
    parser.add_argument("--heartbeat-file")
    parser.add_argument("--start-at", default="")
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


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso8601(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def tick_time(args: argparse.Namespace, tick: int) -> str:
    start_at = parse_iso8601(args.start_at)
    if start_at is None:
        return utc_now()
    observed_at = start_at + timedelta(milliseconds=args.interval_ms * max(0, tick - 1))
    return observed_at.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def read_json(base_url: str, path: str) -> dict[str, object]:
    with request.urlopen(f"{base_url.rstrip('/')}{path}", timeout=2) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"paper runtime API returned non-object JSON for {path}")
    return payload


def post_json(base_url: str, path: str, payload: dict[str, object]) -> dict[str, object]:
    body = json.dumps(payload).encode("utf-8")
    http_request = request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with request.urlopen(http_request, timeout=2) as response:
        result = json.loads(response.read().decode("utf-8"))
    if not isinstance(result, dict):
        raise RuntimeError(f"paper runtime API returned non-object JSON for {path}")
    return result


def emit(payload: dict[str, object], log_path: Path | None, heartbeat_path: Path | None = None) -> None:
    line = json.dumps(payload, sort_keys=True)
    print(line, flush=True)
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(f"{line}\n")
    if heartbeat_path is not None:
        heartbeat_path.parent.mkdir(parents=True, exist_ok=True)
        heartbeat_path.write_text(f"{line}\n", encoding="utf-8")


def decimal_string(value: object, fallback: str) -> str:
    if isinstance(value, (int, float)) and value > 0:
        return f"{value:.8f}".rstrip("0").rstrip(".")
    if isinstance(value, str) and value.strip():
        return value
    return fallback


def bounded_quantity(account: dict[str, object], market: dict[str, object], requested: str) -> str:
    if requested == "rejected":
        return "0"
    equity = account.get("equity")
    price = market.get("price")
    if not isinstance(equity, (int, float)) or not isinstance(price, (int, float)) or price <= 0:
        return "0.001"
    quantity = max(0.001, min(0.003, round((equity * 0.0065) / price, 6)))
    return f"{quantity:.6f}".rstrip("0").rstrip(".")


def market_direction(market: dict[str, object]) -> str:
    fast_average = market.get("moving_average_fast")
    slow_average = market.get("moving_average_slow")
    if not isinstance(fast_average, (int, float)) or not isinstance(slow_average, (int, float)):
        return "unknown"
    if fast_average == slow_average:
        return "flat"
    return "short" if fast_average < slow_average else "long"


def order_event(args: argparse.Namespace, tick: int, market: dict[str, object], account: dict[str, object]) -> dict[str, object]:
    base_url = os.environ["TRADING_API_BASE_URL"]
    side = "sell" if market_direction(market) == "short" else "buy"
    quantity = bounded_quantity(account, market, args.paper_order_request)
    limit_price = decimal_string(market.get("price"), "65000")
    validation = post_json(base_url, "/orders/validate", {
        "symbol": "BTCUSDT",
        "side": side,
        "quantity": float(quantity),
        "order_type": "limit",
        "reason": "reference paper soak bounded order",
    })
    if validation.get("accepted") is not True:
        return {
            "event": "hold",
            "event_id": f"{args.instance_id}:validation-hold:0001",
            "instance_id": args.instance_id,
            "at": tick_time(args, tick),
            "authority_status": "trace_only",
            "reason": f"reference_paper_soak_runtime_api_validation_{validation.get('reason', 'unknown')}",
        }
    return {
        "event": "order_request",
        "event_id": f"{args.instance_id}:order-request:0001",
        "instance_id": args.instance_id,
        "at": tick_time(args, tick),
        "authority_status": "trace_only",
        "intent_kind": "place_order",
        "symbol": "BTCUSDT",
        "side": side,
        "order_type": "limit",
        "quantity": quantity,
        "limit_price": limit_price,
        "reason": f"reference_paper_soak_runtime_api_validation_{validation.get('reason', 'unknown')}",
    }


def hold_event(args: argparse.Namespace, tick: int) -> dict[str, object]:
    return {
        "event": "hold",
        "event_id": f"{args.instance_id}:hold:0002",
        "instance_id": args.instance_id,
        "at": tick_time(args, tick),
        "authority_status": "trace_only",
        "reason": "reference_paper_soak_observed_flat_market_after_entry",
    }


def cancel_event(args: argparse.Namespace, tick: int) -> dict[str, object]:
    return {
        "event": "cancel_order",
        "event_id": f"{args.instance_id}:cancel-order:0003",
        "instance_id": args.instance_id,
        "at": tick_time(args, tick),
        "authority_status": "trace_only",
        "reason": "reference_paper_soak_cancels_remaining_fake_quantity",
    }


def no_action_event(args: argparse.Namespace, tick: int) -> dict[str, object]:
    return {
        "event": "no_action",
        "event_id": f"{args.instance_id}:no-action:{tick:04d}",
        "instance_id": args.instance_id,
        "at": tick_time(args, tick),
        "authority_status": "trace_only",
        "reason": "reference_paper_soak_no_fresh_order",
    }


def heartbeat(args: argparse.Namespace, tick: int) -> dict[str, object]:
    return {
        "event": "runtime_heartbeat",
        "instance_id": args.instance_id,
        "tick": tick,
        "at": tick_time(args, tick),
    }


def stopped(args: argparse.Namespace, tick: int) -> dict[str, object]:
    return {
        "event": "runtime_stopped",
        "instance_id": args.instance_id,
        "tick": tick,
        "at": utc_now(),
    }


def decision_event(args: argparse.Namespace, tick: int, market: dict[str, object], account: dict[str, object]) -> dict[str, object]:
    if tick == 1:
        if market_direction(market) == "flat":
            return hold_event(args, tick)
        return order_event(args, tick, market, account)
    if tick == 2:
        return hold_event(args, tick)
    if tick == 3:
        return cancel_event(args, tick)
    return no_action_event(args, tick)


def main() -> int:
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    args = parse_args()
    base_url = os.environ.get("TRADING_API_BASE_URL", "").strip()
    if not base_url:
        raise RuntimeError("missing TRADING_API_BASE_URL")

    log_path = Path(args.log_file) if args.log_file else None
    heartbeat_path = Path(args.heartbeat_file) if args.heartbeat_file else None
    tick = 0
    while not STOP_REQUESTED:
        tick += 1
        market = read_json(base_url, "/market/snapshot")
        account = read_json(base_url, "/account/state")
        emit(decision_event(args, tick, market, account), log_path)
        emit(heartbeat(args, tick), log_path, heartbeat_path)
        if args.ticks and tick >= args.ticks:
            break
        time.sleep(args.interval_ms / 1000)

    emit(stopped(args, tick), log_path)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
        print(json.dumps({
            "event": "runtime_error",
            "reason": f"reference_paper_soak_failed: {exc}",
            "authority_status": "trace_only",
        }, sort_keys=True), flush=True)
        sys.exit(1)

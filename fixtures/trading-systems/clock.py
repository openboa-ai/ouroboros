#!/usr/bin/env python3
"""Minimal opaque TradingSystem artifact fixture.

The fixture exposes only runtime-boundary output: order request, heartbeat,
and log lines.
When Ouroboros injects TRADING_API_BASE_URL, it reads the paper runtime API
owned by Ouroboros to choose a bounded paper event. It never calls Binance,
credentials, private account state, or exchange gateways directly.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request


STOP_REQUESTED = False


def request_stop(_signum: int, _frame: object) -> None:
    global STOP_REQUESTED
    STOP_REQUESTED = True


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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


def read_provider_json(base_url: str, path: str) -> dict[str, object]:
    url = f"{base_url.rstrip('/')}{path}"
    with request.urlopen(url, timeout=2) as response:
        raw = response.read().decode("utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise RuntimeError(f"paper runtime API returned non-object JSON for {path}")
    return payload


def post_provider_json(base_url: str, path: str, payload: dict[str, object]) -> dict[str, object]:
    body = json.dumps(payload).encode("utf-8")
    http_request = request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with request.urlopen(http_request, timeout=2) as response:
        raw = response.read().decode("utf-8")
    result = json.loads(raw)
    if not isinstance(result, dict):
        raise RuntimeError(f"paper runtime API returned non-object JSON for {path}")
    return result


def decimal_string(value: object, fallback: str) -> str:
    if isinstance(value, (int, float)) and value > 0:
        return f"{value:.2f}".rstrip("0").rstrip(".")
    if isinstance(value, str) and value.strip():
        return value
    return fallback


def acknowledge_comparison_tick(
    base_url: str,
    market: dict[str, object],
    last_delivery_id: str | None,
) -> str | None:
    context = market.get("comparison_tick_context")
    if context is None:
        return last_delivery_id
    if not isinstance(context, dict):
        raise RuntimeError("comparison tick context is not an object")
    delivery_ref = context.get("delivery_ref")
    if not isinstance(delivery_ref, dict):
        raise RuntimeError("comparison tick delivery ref is not an object")
    delivery_id = delivery_ref.get("id")
    if not isinstance(delivery_id, str) or not delivery_id.strip():
        raise RuntimeError("comparison tick delivery id is invalid")
    if delivery_id == last_delivery_id:
        return last_delivery_id

    acknowledgement = post_provider_json(
        base_url,
        "/comparison/tick/ack",
        context,
    )
    acknowledgement_ref = acknowledgement.get("acknowledgement_ref")
    acknowledgement_digest = acknowledgement.get("acknowledgement_digest")
    if (
        not isinstance(acknowledgement_ref, dict)
        or acknowledgement_ref.get("record_kind")
        != "paper_trading_comparison_tick_acknowledgement"
        or not isinstance(acknowledgement_ref.get("id"), str)
        or not acknowledgement_ref["id"]
        or not isinstance(acknowledgement_digest, str)
        or not acknowledgement_digest
    ):
        raise RuntimeError("comparison tick acknowledgement is invalid")
    return delivery_id


def paper_order_payload(
    args: argparse.Namespace,
    provider_base_url: str,
) -> tuple[dict[str, object], str | None]:
    if not provider_base_url:
        return (
            {
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
            },
            None,
        )

    try:
        market = read_provider_json(provider_base_url, "/market/snapshot")
        last_delivery_id = acknowledge_comparison_tick(
            provider_base_url,
            market,
            None,
        )
        read_provider_json(provider_base_url, "/account/state")
        fast_average = market.get("moving_average_fast")
        slow_average = market.get("moving_average_slow")
        if isinstance(fast_average, (int, float)) and isinstance(slow_average, (int, float)):
            direction = (
                "flat"
                if fast_average == slow_average
                else "short"
                if fast_average < slow_average
                else "long"
            )
        else:
            direction = "unknown"
        if direction == "flat":
            return (
                {
                    "event": "hold",
                    "event_id": f"{args.instance_id}:hold:provider-flat-0001",
                    "instance_id": args.instance_id,
                    "authority_status": "trace_only",
                    "at": args.start_at,
                    "reason": "runtime_api_market_signal_flat",
                },
                last_delivery_id,
            )

        side = "sell" if direction == "short" else "buy"
        quantity = "0" if args.paper_order_request == "rejected" else "0.001"
        limit_price = decimal_string(market.get("price"), "60000")
        provider_order = {
            "symbol": "BTCUSDT",
            "side": side,
            "quantity": float(quantity),
            "order_type": "limit",
            "reason": "runtime_api_market_driven_order",
        }
        validation = post_provider_json(provider_base_url, "/orders/validate", provider_order)
        return (
            {
                "event": "order_request",
                "event_id": f"{args.instance_id}:order-request:0001",
                "instance_id": args.instance_id,
                "symbol": "BTCUSDT",
                "intent_kind": "place_order",
                "side": side,
                "order_type": "limit",
                "quantity": quantity,
                "limit_price": limit_price,
                "reason": f"runtime_api_market_signal_{direction}_validation_{validation.get('reason', 'unknown')}",
                "authority_status": "trace_only",
                "at": args.start_at,
            },
            last_delivery_id,
        )
    except (OSError, error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
        raise RuntimeError(f"paper runtime API unavailable: {exc}") from exc


def main() -> int:
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    args = parse_args()

    log_path = Path(args.log_file) if args.log_file else None
    heartbeat_path = Path(args.heartbeat_file) if args.heartbeat_file else None
    provider_base_url = os.environ.get("TRADING_API_BASE_URL", "").strip()
    tick = 0

    order_payload, last_delivery_id = paper_order_payload(args, provider_base_url)
    emit(json.dumps(order_payload, sort_keys=True), log_path, heartbeat_path)

    while not STOP_REQUESTED:
        tick += 1
        payload = {
            "event": "runtime_heartbeat",
            "instance_id": args.instance_id,
            "tick": tick,
            "at": utc_now(),
        }
        emit(json.dumps(payload, sort_keys=True), log_path, heartbeat_path)

        if args.ticks and tick >= args.ticks:
            break

        time.sleep(args.interval_ms / 1000)
        if STOP_REQUESTED or not provider_base_url:
            continue
        try:
            market = read_provider_json(provider_base_url, "/market/snapshot")
            last_delivery_id = acknowledge_comparison_tick(
                provider_base_url,
                market,
                last_delivery_id,
            )
        except (OSError, error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            raise RuntimeError(
                f"paper runtime API unavailable during cadence: {exc}"
            ) from exc

    shutdown_payload = {
        "event": "runtime_stopped",
        "instance_id": args.instance_id,
        "tick": tick,
        "at": utc_now(),
    }
    emit(json.dumps(shutdown_payload, sort_keys=True), log_path, heartbeat_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())

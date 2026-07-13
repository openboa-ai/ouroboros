#!/usr/bin/env python3
import json
import os
import argparse
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib import request

RISK_FRACTION = 0.01
STOP_REQUESTED = False


def request_stop(_signum, _frame):
    global STOP_REQUESTED
    STOP_REQUESTED = True


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_json(base_url, path):
    with request.urlopen(base_url + path, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json(base_url, path, payload):
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        base_url + path,
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def comparison_tick_context(market, last_delivery_id):
    context = market.get("comparison_tick_context")
    if context is None:
        return None
    if not isinstance(context, dict):
        raise RuntimeError("comparison tick context is not an object")
    delivery_ref = context.get("delivery_ref")
    delivery_digest = context.get("delivery_digest")
    tick_sequence = context.get("tick_sequence")
    if (
        not isinstance(delivery_ref, dict)
        or delivery_ref.get("record_kind")
        != "paper_trading_comparison_tick_delivery"
    ):
        raise RuntimeError("comparison tick delivery ref is not an object")
    delivery_id = delivery_ref.get("id")
    if (
        not isinstance(delivery_id, str)
        or not delivery_id.strip()
        or not isinstance(delivery_digest, str)
        or not delivery_digest.startswith("sha256:")
        or not isinstance(tick_sequence, int)
        or isinstance(tick_sequence, bool)
        or tick_sequence < 1
    ):
        raise RuntimeError("comparison tick delivery id is invalid")
    if delivery_id == last_delivery_id:
        return None
    return context


def acknowledge_comparison_tick(base_url, context):
    delivery_ref = context["delivery_ref"]
    if not isinstance(delivery_ref, dict) or not isinstance(delivery_ref.get("id"), str):
        raise RuntimeError("comparison tick delivery ref is invalid")

    acknowledgement = post_json(base_url, "/comparison/tick/ack", context)
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
    return delivery_ref["id"]


def append_event(events_path, event):
    event.setdefault("at", utc_now())
    with open(events_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True) + "\n")


def build_order_request(market, account):
    if market["moving_average_fast"] < market["moving_average_slow"]:
        notional = account["equity"] * RISK_FRACTION
        quantity = round(notional / market["price"], 8)
        return {
            "symbol": market["symbol"],
            "side": "sell",
            "quantity": quantity,
            "order_type": "market",
            "reason": "fast average is below slow average with bounded account risk",
        }
    if market["moving_average_fast"] <= market["moving_average_slow"]:
        return {
            "symbol": market["symbol"],
            "side": "hold",
            "quantity": 0,
            "order_type": "none",
            "reason": "fast average is not above slow average",
        }
    notional = account["equity"] * RISK_FRACTION
    quantity = round(notional / market["price"], 8)
    return {
        "symbol": market["symbol"],
        "side": "buy",
        "quantity": quantity,
        "order_type": "market",
        "reason": "fast average is above slow average with bounded account risk",
    }


def build_rejected_order_request():
    return {
        "symbol": "BTCUSDT",
        "side": "buy",
        "quantity": 0,
        "order_type": "market",
        "reason": "explicit rejected paper order request for Gateway risk validation",
    }


def append_line(line, log_path, heartbeat_path=None):
    print(line, flush=True)
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    if heartbeat_path is not None:
        heartbeat_path.parent.mkdir(parents=True, exist_ok=True)
        heartbeat_path.write_text(line + "\n", encoding="utf-8")


def paper_event_from_intent(args, intent, validation, event_sequence=1, context=None):
    if intent["side"] == "hold" or intent["order_type"] == "none":
        event = {
            "event": "hold",
            "event_id": f"{args.instance_id}:hold:{event_sequence:04d}",
            "instance_id": args.instance_id,
            "at": args.start_at if event_sequence == 1 else utc_now(),
            "authority_status": "trace_only",
            "reason": intent.get("reason", "paper runtime decided to hold"),
        }
    else:
        event = {
            "event": "order_request",
            "event_id": f"{args.instance_id}:order-request:{event_sequence:04d}",
            "instance_id": args.instance_id,
            "at": args.start_at if event_sequence == 1 else utc_now(),
            "authority_status": "trace_only",
            "intent_kind": "place_order",
            "symbol": intent["symbol"],
            "side": intent["side"],
            "order_type": "market",
            "quantity": str(intent["quantity"]),
            "reason": f"{intent.get('reason', 'paper runtime order')} / validation {validation.get('reason', 'unknown')}",
        }
    if context is not None:
        event["comparison_tick_delivery_ref"] = context["delivery_ref"]
        event["comparison_tick_delivery_digest"] = context["delivery_digest"]
    return event


def paper_decision_from_market(args, base_url, market, event_sequence, context=None):
    account = get_json(base_url, "/account/state")
    intent = build_order_request(market, account)
    validation = (
        {"reason": "no_order_request"}
        if intent["side"] == "hold" or intent["order_type"] == "none"
        else post_json(base_url, "/orders/validate", intent)
    )
    return paper_event_from_intent(
        args,
        intent,
        validation,
        event_sequence=event_sequence,
        context=context,
    )


def run_replay(args):
    base_url = os.environ["TRADING_API_BASE_URL"]
    market = get_json(base_url, "/market/snapshot")
    append_event(args.output_events, {"event": "market_snapshot", **market})
    account = get_json(base_url, "/account/state")
    append_event(args.output_events, {"event": "account_state", **account})
    intent = build_order_request(market, account)
    append_event(args.output_events, {"event": "order_request", **intent})
    validation = post_json(base_url, "/orders/validate", intent)
    append_event(args.output_events, {"event": "order_validation", **validation})
    append_event(args.output_events, {"event": "run_complete", "accepted": validation["accepted"]})
    return 0


def run_paper(args):
    if not args.instance_id:
        raise SystemExit("--instance-id is required when --output-events is not set")
    log_path = Path(args.log_file) if args.log_file else None
    heartbeat_path = Path(args.heartbeat_file) if args.heartbeat_file else None
    base_url = ""
    last_delivery_id = None
    initial_context = None
    if args.paper_order_request == "rejected":
        intent = build_rejected_order_request()
        validation = {"reason": "explicit_rejected_paper_order_request"}
        initial_event = paper_event_from_intent(args, intent, validation)
    else:
        base_url = os.environ["TRADING_API_BASE_URL"]
        market = get_json(base_url, "/market/snapshot")
        initial_context = comparison_tick_context(
            market,
            last_delivery_id,
        )
        initial_event = paper_decision_from_market(args, base_url, market, 1)
    append_line(json.dumps(initial_event, sort_keys=True), log_path)
    if initial_context is not None:
        last_delivery_id = acknowledge_comparison_tick(base_url, initial_context)
    tick = 0
    while not STOP_REQUESTED:
        tick += 1
        append_line(json.dumps({
            "event": "runtime_heartbeat",
            "instance_id": args.instance_id,
            "tick": tick,
            "at": utc_now(),
        }, sort_keys=True), log_path, heartbeat_path)
        if args.ticks and tick >= args.ticks:
            break
        time.sleep(args.interval_ms / 1000)
        if STOP_REQUESTED or not base_url:
            continue
        market = get_json(base_url, "/market/snapshot")
        context = comparison_tick_context(
            market,
            last_delivery_id,
        )
        if context is None:
            continue
        tick_sequence = context["tick_sequence"]
        if not isinstance(tick_sequence, int) or isinstance(tick_sequence, bool):
            raise RuntimeError("comparison tick sequence is invalid")
        if tick_sequence >= 2:
            decision = paper_decision_from_market(
                args,
                base_url,
                market,
                tick_sequence,
                context,
            )
            append_line(json.dumps(decision, sort_keys=True), log_path)
        last_delivery_id = acknowledge_comparison_tick(base_url, context)
    append_line(json.dumps({
        "event": "runtime_stopped",
        "instance_id": args.instance_id,
        "tick": tick,
        "at": utc_now(),
    }, sort_keys=True), log_path)
    return 0


def main():
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    parser = argparse.ArgumentParser(description="Minimal replay trading system artifact")
    parser.add_argument("--output-events")
    parser.add_argument("--instance-id")
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

    if args.output_events:
        return run_replay(args)
    return run_paper(args)


if __name__ == "__main__":
    sys.exit(main())

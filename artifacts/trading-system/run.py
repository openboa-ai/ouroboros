#!/usr/bin/env python3
import argparse
import json
import os
from datetime import datetime, timezone
from urllib import request

RISK_FRACTION = 0.01


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


def append_event(events_path, event):
    event.setdefault("at", utc_now())
    with open(events_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True) + "\n")


def build_order_intent(market, account):
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


def main():
    parser = argparse.ArgumentParser(description="Minimal replay trading system artifact")
    parser.add_argument("--output-events", required=True)
    args = parser.parse_args()

    base_url = os.environ["TRADING_API_BASE_URL"]
    market = get_json(base_url, "/market/snapshot")
    append_event(args.output_events, {"event": "market_snapshot", **market})
    account = get_json(base_url, "/account/state")
    append_event(args.output_events, {"event": "account_state", **account})
    intent = build_order_intent(market, account)
    append_event(args.output_events, {"event": "order_intent", **intent})
    validation = post_json(base_url, "/orders/validate", intent)
    append_event(args.output_events, {"event": "order_validation", **validation})
    append_event(args.output_events, {"event": "run_complete", "accepted": validation["accepted"]})


if __name__ == "__main__":
    main()

# Live Trading

## Current Market Scope

- exchange: Binance Futures
- contract type: `USDⓈ-M perpetual`
- initial symbols: `BTCUSDT`, `ETHUSDT`
- long and short both allowed
- simultaneous BTC and ETH positions allowed
- hedge mode supported
- default margin mode: `Isolated`

## Current Safety Rules

- fully automated trading is allowed
- the user remains the ultimate owner of interventions
- every live position must have an exchange-native protective stop
- critical invariant failures are enforced by the execution core

## Current Runtime Policy

- practical low-latency automated trading, not true HFT
- dynamic sizing and leverage within user-specified limits
- broad data ingestion with liveness-aware degradation
- net profitability should include:
  - trading fees
  - funding
  - slippage
  - LLM cost

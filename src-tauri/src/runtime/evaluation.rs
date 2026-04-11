use crate::models::{EquityPoint, PricePoint};

#[derive(Clone, Copy)]
pub enum EvaluationKind {
    Backtest,
    Paper,
}

impl EvaluationKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Backtest => "backtest",
            Self::Paper => "paper",
        }
    }

    pub fn headline_verb(&self) -> &'static str {
        match self {
            Self::Backtest => "Backtest",
            Self::Paper => "Paper replay",
        }
    }
}

#[derive(Clone)]
pub struct ReplayTrade {
    pub symbol: String,
    pub side: String,
    pub entry_time: String,
    pub exit_time: String,
    pub entry_price: f64,
    pub exit_price: f64,
    pub net_pnl: f64,
}

#[derive(Clone)]
pub struct ReplayResult {
    pub headline: String,
    pub summary: String,
    pub gross_pnl: f64,
    pub fee_cost: f64,
    pub slippage_cost: f64,
    pub model_cost: f64,
    pub net_pnl: f64,
    pub trade_count: usize,
    pub position_count: usize,
    pub equity_curve: Vec<EquityPoint>,
    pub trades: Vec<ReplayTrade>,
    pub notes: Vec<String>,
}

#[derive(Clone)]
struct ReplayPosition {
    side: Signal,
    entry_time: String,
    entry_price: f64,
    notional: f64,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Signal {
    Long,
    Short,
}

impl Signal {
    fn as_trade_side(&self) -> &'static str {
        match self {
            Self::Long => "LONG",
            Self::Short => "SHORT",
        }
    }

    fn sign(&self) -> f64 {
        match self {
            Self::Long => 1.0,
            Self::Short => -1.0,
        }
    }
}

pub fn run_replay(kind: EvaluationKind, price_series: &[PricePoint]) -> ReplayResult {
    let bars = match kind {
        EvaluationKind::Backtest => price_series.to_vec(),
        EvaluationKind::Paper => {
            if price_series.len() <= 4 {
                price_series.to_vec()
            } else {
                price_series[price_series.len() - 4..].to_vec()
            }
        }
    };

    if bars.len() < 2 {
        return ReplayResult {
            headline: format!("{} skipped: not enough market bars", kind.headline_verb()),
            summary: "At least two market bars are required to produce a replay run.".into(),
            gross_pnl: 0.0,
            fee_cost: 0.0,
            slippage_cost: 0.0,
            model_cost: 0.0,
            net_pnl: 0.0,
            trade_count: 0,
            position_count: 0,
            equity_curve: price_series
                .iter()
                .map(|point| EquityPoint {
                    label: point.label.clone(),
                    value: 0,
                })
                .collect(),
            trades: Vec::new(),
            notes: vec![
                "Replay aborted because the price series contained fewer than two bars.".into(),
            ],
        };
    }

    let fee_rate = 0.0004;
    let slippage_rate = match kind {
        EvaluationKind::Backtest => 0.0002,
        EvaluationKind::Paper => 0.0003,
    };
    let model_cost = match kind {
        EvaluationKind::Backtest => (bars.len() as f64) * 0.35,
        EvaluationKind::Paper => (bars.len() as f64) * 0.25,
    };

    let mut trades = Vec::new();
    let mut realized_gross = 0.0;
    let mut fee_cost = 0.0;
    let mut slippage_cost = 0.0;
    let mut equity_curve = Vec::with_capacity(bars.len());

    let mut btc_position: Option<ReplayPosition> = None;
    let mut eth_position: Option<ReplayPosition> = None;

    for index in 1..bars.len() {
        let previous = &bars[index - 1];
        let current = &bars[index];

        process_symbol_bar(
            "BTCUSDT",
            current.label.as_str(),
            previous.btc as f64,
            current.btc as f64,
            1600.0,
            fee_rate,
            slippage_rate,
            &mut btc_position,
            &mut realized_gross,
            &mut fee_cost,
            &mut slippage_cost,
            &mut trades,
        );

        process_symbol_bar(
            "ETHUSDT",
            current.label.as_str(),
            previous.eth as f64,
            current.eth as f64,
            900.0,
            fee_rate,
            slippage_rate,
            &mut eth_position,
            &mut realized_gross,
            &mut fee_cost,
            &mut slippage_cost,
            &mut trades,
        );

        let running_net = realized_gross - fee_cost - slippage_cost - model_cost;
        equity_curve.push(EquityPoint {
            label: current.label.clone(),
            value: running_net.round() as i64,
        });
    }

    let last_bar = bars.last().expect("bars checked above");
    close_position(
        "BTCUSDT",
        last_bar.label.as_str(),
        last_bar.btc as f64,
        fee_rate,
        slippage_rate,
        &mut btc_position,
        &mut realized_gross,
        &mut fee_cost,
        &mut slippage_cost,
        &mut trades,
    );
    close_position(
        "ETHUSDT",
        last_bar.label.as_str(),
        last_bar.eth as f64,
        fee_rate,
        slippage_rate,
        &mut eth_position,
        &mut realized_gross,
        &mut fee_cost,
        &mut slippage_cost,
        &mut trades,
    );

    let net_pnl = realized_gross - fee_cost - slippage_cost - model_cost;
    if let Some(last) = equity_curve.last_mut() {
        last.value = net_pnl.round() as i64;
    }

    let headline = if net_pnl >= 0.0 {
        format!(
            "{} net PnL stayed positive after fees, slippage, and model cost.",
            kind.headline_verb()
        )
    } else {
        format!(
            "{} lost edge after fees, slippage, and model cost.",
            kind.headline_verb()
        )
    };
    let summary = format!(
        "{} produced {} trades across {} replay bars with net PnL ${:.2}.",
        kind.headline_verb(),
        trades.len(),
        bars.len(),
        net_pnl
    );
    let notes = vec![
        "Replay engine uses a simple momentum crossover over the persisted workspace price series.".into(),
        "Simulated exchange costs include fees, slippage, and model cost so evaluation remains net-of-cost.".into(),
        format!("Window size: {} bars.", bars.len()),
    ];

    ReplayResult {
        headline,
        summary,
        gross_pnl: realized_gross,
        fee_cost,
        slippage_cost,
        model_cost,
        net_pnl,
        trade_count: trades.len(),
        position_count: 2,
        equity_curve,
        trades,
        notes,
    }
}

fn process_symbol_bar(
    symbol: &str,
    current_label: &str,
    previous_price: f64,
    current_price: f64,
    notional: f64,
    fee_rate: f64,
    slippage_rate: f64,
    position: &mut Option<ReplayPosition>,
    realized_gross: &mut f64,
    fee_cost: &mut f64,
    slippage_cost: &mut f64,
    trades: &mut Vec<ReplayTrade>,
) {
    let signal = if current_price > previous_price {
        Some(Signal::Long)
    } else if current_price < previous_price {
        Some(Signal::Short)
    } else {
        None
    };

    let Some(signal) = signal else {
        return;
    };

    if let Some(existing) = position {
        if existing.side == signal {
            return;
        }
    }

    close_position(
        symbol,
        current_label,
        current_price,
        fee_rate,
        slippage_rate,
        position,
        realized_gross,
        fee_cost,
        slippage_cost,
        trades,
    );

    *position = Some(ReplayPosition {
        side: signal,
        entry_time: current_label.into(),
        entry_price: current_price,
        notional,
    });
}

fn close_position(
    symbol: &str,
    current_label: &str,
    current_price: f64,
    fee_rate: f64,
    slippage_rate: f64,
    position: &mut Option<ReplayPosition>,
    realized_gross: &mut f64,
    fee_cost: &mut f64,
    slippage_cost: &mut f64,
    trades: &mut Vec<ReplayTrade>,
) {
    let Some(existing) = position.take() else {
        return;
    };

    let gross_pnl = existing.side.sign()
        * ((current_price - existing.entry_price) / existing.entry_price)
        * existing.notional;
    let fees = existing.notional * fee_rate * 2.0;
    let slippage = existing.notional * slippage_rate * 2.0;
    let net_pnl = gross_pnl - fees - slippage;

    *realized_gross += gross_pnl;
    *fee_cost += fees;
    *slippage_cost += slippage;
    trades.push(ReplayTrade {
        symbol: symbol.into(),
        side: existing.side.as_trade_side().into(),
        entry_time: existing.entry_time,
        exit_time: current_label.into(),
        entry_price: existing.entry_price,
        exit_price: current_price,
        net_pnl,
    });
}

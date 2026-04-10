use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::{
    BootstrapState, CheckpointSummary, DecisionEntry, EquityPoint, ExposurePoint, LiveOrder,
    LivePosition, MetricCardData, PricePoint, ProviderStatus, TradingMode, WorkspaceSummary,
};

pub struct AppState {
    pub bootstrap: Mutex<BootstrapState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            bootstrap: Mutex::new(seed_bootstrap_state()),
        }
    }
}

impl AppState {
    pub fn snapshot(&self) -> BootstrapState {
        self.bootstrap
            .lock()
            .expect("bootstrap state lock poisoned")
            .clone()
    }

    pub fn pause_global_automation(&self) -> BootstrapState {
        let mut state = self.bootstrap.lock().expect("bootstrap state lock poisoned");
        state.mode = TradingMode::Observer;
        state.automation_status = "paused".into();
        state.status_note = Some(
            "Global automation was paused through the service layer.".into(),
        );
        prepend_decision(
            &mut state,
            DecisionEntry {
                id: next_id("decision"),
                kind: "Control".into(),
                tone: "warning".into(),
                headline: "Global automation paused".into(),
                reason: "The service layer switched the runtime into observer mode while preserving live-centered context for inspection.".into(),
                timestamp: now_label(),
            },
        );
        state.clone()
    }

    pub fn flatten_all_positions(&self) -> BootstrapState {
        let mut state = self.bootstrap.lock().expect("bootstrap state lock poisoned");
        state.status_note =
            Some("Service-layer intervention flattened all live positions in the desktop runtime.".into());
        state.positions.clear();
        state.orders.clear();
        for metric in state.metrics.iter_mut() {
            if metric.label == "Risk Budget" {
                metric.value = "0%".into();
                metric.delta = "Reset after flatten-all intervention".into();
            }
        }
        prepend_decision(
            &mut state,
            DecisionEntry {
                id: next_id("decision"),
                kind: "Intervention".into(),
                tone: "warning".into(),
                headline: "All live positions flattened".into(),
                reason: "The service layer executed a flatten-all command and reset live positions and orders without exposing raw workspace mutation to the client.".into(),
                timestamp: now_label(),
            },
        );
        prepend_checkpoint(
            &mut state,
            CheckpointSummary {
                id: next_id("checkpoint"),
                alias: "incident-flatten-all".into(),
                r#type: "incident".into(),
                type_tone: "danger".into(),
                summary: "Client-triggered flatten-all command captured as an incident checkpoint."
                    .into(),
                created_at: now_label(),
                performance: "Live risk reset to flat".into(),
            },
        );
        state.clone()
    }

    pub fn create_export_checkpoint(&self) -> BootstrapState {
        let mut state = self.bootstrap.lock().expect("bootstrap state lock poisoned");
        let alias = format!("export-{}", short_clock_suffix());
        state.status_note = Some(
            "A fresh export checkpoint was created from the current live-centered asset."
                .into(),
        );
        prepend_checkpoint(
            &mut state,
            CheckpointSummary {
                id: next_id("checkpoint"),
                alias,
                r#type: "export".into(),
                type_tone: "warning".into(),
                summary:
                    "Fresh export checkpoint created before generating a sanitized live-centered bundle."
                        .into(),
                created_at: now_label(),
                performance: "Export policy sanitized-live-centered".into(),
            },
        );
        prepend_decision(
            &mut state,
            DecisionEntry {
                id: next_id("decision"),
                kind: "Export".into(),
                tone: "neutral".into(),
                headline: "Export checkpoint created".into(),
                reason: "The service layer created a fresh checkpoint before export so the desktop client can share a stable live-centered asset.".into(),
                timestamp: now_label(),
            },
        );
        state.clone()
    }
}

fn prepend_checkpoint(state: &mut BootstrapState, checkpoint: CheckpointSummary) {
    state.workspace.current_checkpoint_alias = checkpoint.alias.clone();
    state.checkpoints.insert(0, checkpoint);
}

fn prepend_decision(state: &mut BootstrapState, decision: DecisionEntry) {
    state.decisions.insert(0, decision);
}

fn next_id(prefix: &str) -> String {
    format!("{}-{}", prefix, uuid_like_suffix())
}

fn uuid_like_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{nanos:x}")
}

fn short_clock_suffix() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", secs % 100000)
}

fn now_label() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("UTC epoch {secs}")
}

fn seed_bootstrap_state() -> BootstrapState {
    BootstrapState {
        mode: TradingMode::Paper,
        automation_status: "active".into(),
        status_note: Some(
            "Research and live-facing context are running through the service layer.".into(),
        ),
        workspace: WorkspaceSummary {
            artifact_id: "0196252c-a974-7ce8-94de-31f9f0f2b9c9".into(),
            slug: "autokairos-paper-stack".into(),
            live_lane_label: "live-lane/main".into(),
            current_checkpoint_alias: "promote-btc-eth-apr10".into(),
            export_policy_label: "sanitized-live-centered".into(),
        },
        providers: vec![
            ProviderStatus {
                name: "Codex".into(),
                status_label: "Connected via user auth".into(),
                usage_label: "6.1k tokens this session".into(),
            },
            ProviderStatus {
                name: "Claude Code".into(),
                status_label: "Connected via user auth".into(),
                usage_label: "2 managed sessions active".into(),
            },
        ],
        metrics: vec![
            MetricCardData {
                label: "Net PnL".into(),
                value: "+$4,218".into(),
                delta: "Includes fees, funding, slippage, and model cost".into(),
                description: "Current promoted artifact".into(),
                icon: "up".into(),
            },
            MetricCardData {
                label: "Risk Budget".into(),
                value: "61%".into(),
                delta: "Adaptive budget after BTC momentum expansion".into(),
                description: "Trader-controlled portfolio allocation".into(),
                icon: "risk".into(),
            },
            MetricCardData {
                label: "Leverage".into(),
                value: "4.2x".into(),
                delta: "Dynamic within user cap".into(),
                description: "Live portfolio effective leverage".into(),
                icon: "leverage".into(),
            },
            MetricCardData {
                label: "Intervention Load".into(),
                value: "1 incident".into(),
                delta: "No protective-stop violations in current live state".into(),
                description: "Fixed core evaluation dimension".into(),
                icon: "momentum".into(),
            },
        ],
        price_series: vec![
            PricePoint {
                label: "00:00".into(),
                btc: 68620,
                eth: 3528,
            },
            PricePoint {
                label: "04:00".into(),
                btc: 68910,
                eth: 3554,
            },
            PricePoint {
                label: "08:00".into(),
                btc: 69580,
                eth: 3624,
            },
            PricePoint {
                label: "12:00".into(),
                btc: 69220,
                eth: 3598,
            },
            PricePoint {
                label: "16:00".into(),
                btc: 70140,
                eth: 3660,
            },
            PricePoint {
                label: "20:00".into(),
                btc: 70610,
                eth: 3695,
            },
        ],
        equity_series: vec![
            EquityPoint {
                label: "Mon".into(),
                value: 1180,
            },
            EquityPoint {
                label: "Tue".into(),
                value: 1670,
            },
            EquityPoint {
                label: "Wed".into(),
                value: 2140,
            },
            EquityPoint {
                label: "Thu".into(),
                value: 2865,
            },
            EquityPoint {
                label: "Fri".into(),
                value: 3340,
            },
            EquityPoint {
                label: "Sat".into(),
                value: 4218,
            },
        ],
        exposure_series: vec![
            ExposurePoint {
                symbol: "BTCUSDT".into(),
                value: 58,
            },
            ExposurePoint {
                symbol: "ETHUSDT".into(),
                value: 31,
            },
            ExposurePoint {
                symbol: "Dry Powder".into(),
                value: 11,
            },
        ],
        positions: vec![
            LivePosition {
                symbol: "BTCUSDT".into(),
                side: "LONG".into(),
                size: "0.46 BTC".into(),
                entry: "69,880".into(),
                pnl: "+$1,284".into(),
                protective_stop: "68,940".into(),
                context_tag: "breakout + flow + risk budget".into(),
            },
            LivePosition {
                symbol: "ETHUSDT".into(),
                side: "SHORT".into(),
                size: "11.2 ETH".into(),
                entry: "3,674".into(),
                pnl: "+$312".into(),
                protective_stop: "3,728".into(),
                context_tag: "fade extension + book pressure".into(),
            },
        ],
        orders: vec![
            LiveOrder {
                id: "order-1".into(),
                symbol: "BTCUSDT".into(),
                kind: "Protective stop".into(),
                status: "Active".into(),
                status_tone: "positive".into(),
                summary: "Exchange-native stop verified after latest position expansion.".into(),
            },
            LiveOrder {
                id: "order-2".into(),
                symbol: "ETHUSDT".into(),
                kind: "Scale-out".into(),
                status: "Queued".into(),
                status_tone: "warning".into(),
                summary: "Waiting for volatility band confirmation before partial close.".into(),
            },
        ],
        decisions: vec![
            DecisionEntry {
                id: "decision-1".into(),
                kind: "Entry".into(),
                tone: "positive".into(),
                headline: "BTC long still favored".into(),
                reason: "Recent breakout remains supported by positive flow and no current liveness degradation. Trader kept leverage below the user cap and refreshed the protective stop path.".into(),
                timestamp: "UTC 2026-04-10 13:42".into(),
            },
            DecisionEntry {
                id: "decision-2".into(),
                kind: "Risk".into(),
                tone: "warning".into(),
                headline: "ETH short stays smaller than BTC long".into(),
                reason: "Portfolio-level context still prefers BTC as the dominant expression. ETH remains active but receives lower size due to weaker cumulative checkpoint evidence.".into(),
                timestamp: "UTC 2026-04-10 13:36".into(),
            },
            DecisionEntry {
                id: "decision-3".into(),
                kind: "Evaluation".into(),
                tone: "neutral".into(),
                headline: "Rejected candidate remains in shadow evaluation".into(),
                reason: "A rejected candidate is still running under the same fixed paper policy so the evaluator can inspect whether rejection quality is degrading.".into(),
                timestamp: "UTC 2026-04-10 12:58".into(),
            },
        ],
        checkpoints: vec![
            CheckpointSummary {
                id: "0196256c-e9aa-7c4d-967e-cb0ec87907df".into(),
                alias: "promote-btc-eth-apr10".into(),
                r#type: "promotion".into(),
                type_tone: "positive".into(),
                summary: "Promoted after time-series paper outperformance across recent and cumulative views.".into(),
                created_at: "UTC 2026-04-10 12:02".into(),
                performance: "Paper +6.4% / Shadow +2.1%".into(),
            },
            CheckpointSummary {
                id: "0196251f-7e08-76f2-b48d-0f88a2995874".into(),
                alias: "incident-stop-repair".into(),
                r#type: "incident".into(),
                type_tone: "danger".into(),
                summary: "Execution core repaired a missing stop registration before allowing new entries.".into(),
                created_at: "UTC 2026-04-09 18:40".into(),
                performance: "No forced flatten required".into(),
            },
            CheckpointSummary {
                id: "01962489-41de-73ce-9f5b-ff2696878ec9".into(),
                alias: "export-paper-stack".into(),
                r#type: "export".into(),
                type_tone: "warning".into(),
                summary: "Sanitized export generated from a fresh checkpoint before sharing the live-centered asset.".into(),
                created_at: "UTC 2026-04-09 08:05".into(),
                performance: "Export policy sanitized-live-centered".into(),
            },
        ],
    }
}

use crate::runtime::{run_replay, EvaluationKind, SIMULATED_ADAPTER_ID};

use super::super::*;

impl WorkspaceRepository {
    pub fn run_backtest(&self) -> Result<BootstrapState, String> {
        self.run_evaluation(EvaluationKind::Backtest)
    }

    pub fn run_paper_evaluation(&self) -> Result<BootstrapState, String> {
        self.run_evaluation(EvaluationKind::Paper)
    }

    fn run_evaluation(&self, kind: EvaluationKind) -> Result<BootstrapState, String> {
        let strategy_path = self.root.join("strategy.json");
        let strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        let live_lane_path = self.resolve_ref(&strategy_path, &strategy.active.live_lane_ref);
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let eval_summaries_path =
            self.resolve_ref(&live_lane_path, &live_lane.state_refs.eval_summaries_ref);
        let adapters_index_path = self.resolve_ref(&strategy_path, &strategy.indexes.adapters_ref);
        let evaluations_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.evaluations_ref);
        let collections_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.collections_ref);

        let dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let mut decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let mut eval_summaries = self.read_json_path::<EvalSummariesFile>(&eval_summaries_path)?;
        let mut evaluations_index =
            self.read_json_path::<EvaluationsIndexFile>(&evaluations_index_path)?;
        let adapters_index = self.read_json_path::<AdaptersIndexFile>(&adapters_index_path)?;
        let collections_index =
            self.read_json_path::<CollectionsIndexFile>(&collections_index_path)?;

        let adapter_index = adapters_index
            .adapters
            .iter()
            .find(|item| item.id == SIMULATED_ADAPTER_ID)
            .or_else(|| adapters_index.adapters.first())
            .ok_or_else(|| "workspace has no adapters configured".to_string())?;
        let adapter_path = self.resolve_ref(&adapters_index_path, &adapter_index.definition_ref);
        let adapter = self.read_json_path::<AdapterRecordFile>(&adapter_path)?;

        let supported = match kind {
            EvaluationKind::Backtest => adapter.supports_backtest,
            EvaluationKind::Paper => adapter.supports_paper,
        };
        if !supported {
            return Err(format!(
                "adapter {} does not support {} evaluation",
                adapter.name,
                kind.as_str()
            ));
        }

        let replay = run_replay(kind, &dashboard.price_series);
        let run_id = uuid_v7_string();
        let created_at = now_label();
        let run_path = self.evaluation_run_file_path(&run_id);
        let run_path_ref = self.display_path(&run_path);
        let collection_refs = collections_index
            .items
            .iter()
            .map(|item| {
                self.display_path(&self.resolve_ref(&collections_index_path, &item.path_ref))
            })
            .collect::<Vec<_>>();

        let run_file = EvaluationRunFile {
            run_id: run_id.clone(),
            kind: kind.as_str().into(),
            status: "completed".into(),
            headline: replay.headline.clone(),
            summary: replay.summary.clone(),
            created_at: created_at.clone(),
            adapter_ref: self.display_path(&adapter_path),
            adapter_name: adapter.name.clone(),
            collection_refs: collection_refs.clone(),
            gross_pnl: replay.gross_pnl,
            fee_cost: replay.fee_cost,
            slippage_cost: replay.slippage_cost,
            model_cost: replay.model_cost,
            net_pnl: replay.net_pnl,
            trade_count: replay.trade_count,
            position_count: replay.position_count,
            path_ref: run_path_ref.clone(),
            equity_curve: replay.equity_curve.clone(),
            trades: replay
                .trades
                .iter()
                .map(|trade| EvaluationTradeFile {
                    symbol: trade.symbol.clone(),
                    side: trade.side.clone(),
                    entry_time: trade.entry_time.clone(),
                    exit_time: trade.exit_time.clone(),
                    entry_price: trade.entry_price,
                    exit_price: trade.exit_price,
                    net_pnl: trade.net_pnl,
                })
                .collect(),
            notes: replay.notes.clone(),
        };
        self.write_json_path(&run_path, &run_file)?;

        evaluations_index.items.insert(
            0,
            EvaluationRunSummaryFile {
                run_id: run_id.clone(),
                kind: kind.as_str().into(),
                status: "completed".into(),
                headline: replay.headline.clone(),
                summary: replay.summary.clone(),
                created_at: created_at.clone(),
                adapter_ref: self.display_path(&adapter_path),
                adapter_name: adapter.name.clone(),
                collection_refs: collection_refs.clone(),
                net_pnl: replay.net_pnl,
                trade_count: replay.trade_count,
                position_count: replay.position_count,
                path_ref: run_path_ref.clone(),
            },
        );
        self.write_json_path(&evaluations_index_path, &evaluations_index)?;

        let summary_ref = format!("../eval-summaries/items/{run_id}/summary.json");
        eval_summaries.summaries.insert(
            0,
            EvalSummaryRecord {
                summary_id: Some(run_id.clone()),
                headline: Some(replay.headline.clone()),
                created_at: Some(created_at.clone()),
                path_ref: Some(summary_ref),
                evidence_refs: std::iter::once(run_path_ref.clone())
                    .chain(collection_refs.iter().cloned())
                    .collect(),
            },
        );
        self.write_json_path(&eval_summaries_path, &eval_summaries)?;

        prepend_decision(
            &mut decisions.decisions,
            DecisionEntry {
                id: uuid_v7_string(),
                kind: format!("{} Evaluation", kind.headline_verb()),
                tone: if replay.net_pnl >= 0.0 {
                    "positive".into()
                } else {
                    "warning".into()
                },
                headline: replay.headline.clone(),
                reason: replay.summary.clone(),
                timestamp: created_at.clone(),
            },
        );
        self.write_json_path(&decisions_path, &decisions)?;

        self.materialize_live_context_documents()?;
        self.append_operation(
            match kind {
                EvaluationKind::Backtest => "run_backtest",
                EvaluationKind::Paper => "run_paper_evaluation",
            },
            "workspace",
            format!("{} completed via simulated exchange adapter.", kind.headline_verb()),
            format!(
                "{} stored run {}, updated evaluation summaries, and preserved raw evidence refs for replay.",
                kind.headline_verb(),
                run_id
            ),
            std::iter::once(run_path_ref)
                .chain(std::iter::once(self.display_path(&evaluations_index_path)))
                .chain(std::iter::once(self.display_path(&eval_summaries_path)))
                .chain(std::iter::once(self.display_path(&decisions_path)))
                .chain(collection_refs)
                .collect(),
        )?;

        self.load_bootstrap_state()
    }
}

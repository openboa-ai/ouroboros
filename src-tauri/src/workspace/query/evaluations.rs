use super::super::*;
use crate::models::EvaluationTradeState;

impl WorkspaceRepository {
    pub fn load_evaluation_run_detail(
        &self,
        run_id: &str,
    ) -> Result<EvaluationRunDetailState, String> {
        let run_path = self.evaluation_run_file_path(run_id);
        let run = self.read_json_path::<EvaluationRunFile>(&run_path)?;

        Ok(EvaluationRunDetailState {
            id: run.run_id,
            kind: run.kind,
            status: run.status,
            headline: run.headline,
            summary: run.summary,
            created_at: run.created_at,
            adapter_ref: run.adapter_ref,
            adapter_name: run.adapter_name,
            collection_refs: run.collection_refs,
            gross_pnl: run.gross_pnl,
            fee_cost: run.fee_cost,
            slippage_cost: run.slippage_cost,
            model_cost: run.model_cost,
            net_pnl: run.net_pnl,
            trade_count: run.trade_count,
            position_count: run.position_count,
            path_ref: self.display_path(&run_path),
            equity_curve: run.equity_curve,
            trades: run
                .trades
                .into_iter()
                .map(|trade| EvaluationTradeState {
                    symbol: trade.symbol,
                    side: trade.side,
                    entry_time: trade.entry_time,
                    exit_time: trade.exit_time,
                    entry_price: trade.entry_price,
                    exit_price: trade.exit_price,
                    net_pnl: trade.net_pnl,
                })
                .collect(),
            notes: run.notes,
        })
    }
}

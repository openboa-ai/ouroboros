//! Shared parser keeps service/fixture/recovery mode selection testable off the Linux host.
use clap::Parser;
#[derive(Debug, Parser)]
pub struct Args {
    #[arg(long)]
    pub config: std::path::PathBuf,
    #[arg(long)]
    pub require_managed_guard: bool,
    #[arg(long, conflicts_with_all = ["max_executions", "service", "inspect_claim", "idle_timeout_seconds", "poll_interval_seconds"])]
    pub reconcile: Option<uuid::Uuid>,
    /// Inspect an original claim without claiming, running, or repairing it.
    #[arg(long, conflicts_with_all = ["max_executions", "service", "reconcile", "idle_timeout_seconds", "poll_interval_seconds"])]
    pub inspect_claim: Option<uuid::Uuid>,
    #[arg(long, conflicts_with = "service", value_parser = clap::value_parser!(u16).range(1..=100))]
    pub max_executions: Option<u16>,
    #[arg(long, requires = "max_executions", value_parser = clap::value_parser!(u16).range(1..=300))]
    pub idle_timeout_seconds: Option<u16>,
    /// Remain available for separately admitted work until stopped. Requires a managed guard.
    #[arg(long, conflicts_with_all = ["max_executions", "idle_timeout_seconds", "reconcile", "inspect_claim"])]
    pub service: bool,
    #[arg(long, requires = "service", value_parser = clap::value_parser!(u16).range(1..=60))]
    pub poll_interval_seconds: Option<u16>,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn service_is_explicit_and_cannot_mix_with_fixture_or_recovery_modes() {
        let base = ["runtime", "--config", "/protected/runtime.json"];
        assert!(!Args::try_parse_from(base).unwrap().service);
        assert!(
            Args::try_parse_from([base.as_slice(), &["--service"]].concat())
                .unwrap()
                .service
        );
        for extra in [
            vec!["--service", "--max-executions", "2"],
            vec!["--service", "--idle-timeout-seconds", "2"],
            vec![
                "--service",
                "--reconcile",
                "11111111-1111-4111-8111-111111111111",
            ],
            vec![
                "--service",
                "--inspect-claim",
                "11111111-1111-4111-8111-111111111111",
            ],
            vec!["--poll-interval-seconds", "1"],
            vec!["--service", "--poll-interval-seconds", "0"],
            vec!["--service", "--poll-interval-seconds", "61"],
        ] {
            assert!(
                Args::try_parse_from([base.as_slice(), &extra].concat()).is_err(),
                "accepted conflicting options: {extra:?}"
            );
        }
    }
}

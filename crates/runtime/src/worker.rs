//! Slot scheduling consumes Core admissions. Service mode also polls finite registered continuations.
//! It never retries an ambiguous claim or renews an instance allowance.
use anyhow::{Result, ensure};
use serde::Serialize;
use std::{future::Future, time::Duration};

#[derive(Clone, Copy)]
pub enum WorkerPolicy {
    Bounded {
        max_executions: u16,
        idle_seconds: u16,
    },
    Service {
        poll_seconds: u16,
    },
}
#[derive(Clone, Copy)]
pub struct WaitPolicy {
    pub idle_timeout: Option<Duration>,
    pub poll_interval: Duration,
}
impl WaitPolicy {
    pub fn reconciles_services(self) -> bool {
        self.idle_timeout.is_none()
    }
}
impl WorkerPolicy {
    fn waiting(self) -> Result<WaitPolicy> {
        match self {
            Self::Bounded {
                max_executions,
                idle_seconds,
            } => {
                ensure!(
                    (1..=100).contains(&max_executions) && (1..=300).contains(&idle_seconds),
                    "invalid worker bounds"
                );
                Ok(WaitPolicy {
                    idle_timeout: Some(Duration::from_secs(idle_seconds.into())),
                    poll_interval: Duration::from_millis(100),
                })
            }
            Self::Service { poll_seconds } => {
                ensure!(
                    (1..=60).contains(&poll_seconds),
                    "invalid service polling interval"
                );
                Ok(WaitPolicy {
                    idle_timeout: None,
                    poll_interval: Duration::from_secs(poll_seconds.into()),
                })
            }
        }
    }
}
#[derive(Debug, PartialEq, Eq)]
pub enum Step {
    Completed,
    Idle,
    Stopped,
}

/// Only the authenticated execution-permission observer may produce this marker.
/// A request failure elsewhere or a matching error string is not an owner restriction.
#[derive(Debug)]
pub struct ExecutionRestricted;
impl std::fmt::Display for ExecutionRestricted {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("current execution permission ended")
    }
}
impl std::error::Error for ExecutionRestricted {}

pub fn reconciled_restriction(outcome: &Result<()>, wait: WaitPolicy, slot_released: bool) -> bool {
    wait.reconciles_services()
        && slot_released
        && outcome
            .as_ref()
            .err()
            .is_some_and(|error| error.is::<ExecutionRestricted>())
}
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum End {
    StopRequested,
    IdleLimitReached,
    ExecutionLimitReached,
}
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct Summary {
    pub worker: End,
    pub completed_executions: u64,
}

/// Errors propagate immediately. The caller retains all original claim and cleanup records.
pub async fn drive<F, Fut>(policy: WorkerPolicy, mut step: F) -> Result<Summary>
where
    F: FnMut(WaitPolicy) -> Fut,
    Fut: Future<Output = Result<Step>>,
{
    let wait = policy.waiting()?;
    let mut completed = 0_u64;
    let worker = loop {
        match step(wait).await? {
            Step::Stopped => break End::StopRequested,
            Step::Idle if matches!(policy, WorkerPolicy::Bounded { .. }) => {
                break End::IdleLimitReached;
            }
            Step::Idle => continue,
            Step::Completed => {
                completed = completed
                    .checked_add(1)
                    .ok_or_else(|| anyhow::anyhow!("worker counter exhausted"))?
            }
        }
        if let WorkerPolicy::Bounded { max_executions, .. } = policy
            && completed >= u64::from(max_executions)
        {
            break End::ExecutionLimitReached;
        }
    };
    Ok(Summary {
        worker,
        completed_executions: completed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::Cell, collections::VecDeque};
    #[test]
    fn only_an_observed_restriction_after_actual_return_allows_the_service_to_continue() {
        let service = WorkerPolicy::Service { poll_seconds: 1 }.waiting().unwrap();
        let bounded = WorkerPolicy::Bounded {
            max_executions: 2,
            idle_seconds: 1,
        }
        .waiting()
        .unwrap();
        let restricted = Err(anyhow::Error::new(ExecutionRestricted).context("program observer"));
        assert!(reconciled_restriction(&restricted, service, true));
        assert!(!reconciled_restriction(&restricted, service, false));
        assert!(!reconciled_restriction(&restricted, bounded, true));
        for error in [
            "current execution permission ended",
            "HTTP 403",
            "Core response lost",
        ] {
            assert!(!reconciled_restriction(
                &Err(anyhow::anyhow!(error)),
                service,
                true
            ));
        }
    }
    #[test]
    fn bounded_workers_never_drive_company_continuations() {
        assert!(
            !WorkerPolicy::Bounded {
                max_executions: 1,
                idle_seconds: 1
            }
            .waiting()
            .unwrap()
            .reconciles_services()
        );
        assert!(
            WorkerPolicy::Service { poll_seconds: 1 }
                .waiting()
                .unwrap()
                .reconciles_services()
        );
    }
    #[tokio::test]
    async fn service_remains_idle_and_processes_more_than_finite_limit_until_stop() {
        let mut steps: VecDeque<_> = [Step::Idle, Step::Idle].into();
        steps.extend((0..101).map(|_| Step::Completed));
        steps.extend([Step::Idle, Step::Stopped]);
        let summary = drive(WorkerPolicy::Service { poll_seconds: 2 }, |wait| {
            assert!(wait.idle_timeout.is_none());
            assert!(wait.reconciles_services());
            assert_eq!(wait.poll_interval, Duration::from_secs(2));
            std::future::ready(Ok(steps
                .pop_front()
                .expect("must stop without another claim")))
        })
        .await
        .unwrap();
        assert_eq!(
            summary,
            Summary {
                worker: End::StopRequested,
                completed_executions: 101
            }
        );
        assert!(steps.is_empty());
    }
    #[tokio::test]
    async fn ambiguous_failure_is_never_retried() {
        let calls = Cell::new(0);
        let error = drive(WorkerPolicy::Service { poll_seconds: 1 }, |_| {
            calls.set(calls.get() + 1);
            std::future::ready(if calls.get() == 1 {
                Ok(Step::Completed)
            } else {
                Err(anyhow::anyhow!("claim response lost"))
            })
        })
        .await
        .unwrap_err();
        assert_eq!(calls.get(), 2);
        assert_eq!(error.to_string(), "claim response lost");
    }
    #[tokio::test]
    async fn finite_worker_preserves_limits_and_validates_before_work() {
        let calls = Cell::new(0);
        for policy in [
            WorkerPolicy::Service { poll_seconds: 0 },
            WorkerPolicy::Bounded {
                max_executions: 0,
                idle_seconds: 2,
            },
        ] {
            assert!(
                drive(policy, |_| {
                    calls.set(1);
                    std::future::ready(Ok(Step::Completed))
                })
                .await
                .is_err()
            );
        }
        assert_eq!(calls.get(), 0);
        let result = drive(
            WorkerPolicy::Bounded {
                max_executions: 2,
                idle_seconds: 1,
            },
            |wait| {
                assert_eq!(wait.idle_timeout, Some(Duration::from_secs(1)));
                calls.set(calls.get() + 1);
                std::future::ready(Ok(Step::Completed))
            },
        )
        .await
        .unwrap();
        assert_eq!(calls.get(), 2);
        assert_eq!(result.worker, End::ExecutionLimitReached);
        let result = drive(
            WorkerPolicy::Bounded {
                max_executions: 2,
                idle_seconds: 1,
            },
            |_| std::future::ready(Ok(Step::Idle)),
        )
        .await
        .unwrap();
        assert_eq!(
            result,
            Summary {
                worker: End::IdleLimitReached,
                completed_executions: 0
            }
        );
    }
}

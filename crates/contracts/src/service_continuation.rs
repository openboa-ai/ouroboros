//! Finite recovery of one Company call; never permission to create fresh business requests.
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ServiceContinuationRequest {
    pub execution_id: Uuid,
    pub max_restarts: u16,
    pub restart_window_seconds: u32,
    pub backoff_seconds: u32,
}
impl ServiceContinuationRequest {
    pub fn valid(&self) -> bool {
        !self.execution_id.is_nil()
            && (1..=32).contains(&self.max_restarts)
            && (1..=86400).contains(&self.restart_window_seconds)
            && (1..=3600).contains(&self.backoff_seconds)
            && self.backoff_seconds < self.restart_window_seconds
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ServiceContinuationStop {
    /// The execution currently displayed to the operator, including any admitted successor.
    pub expected_execution_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn continuation_is_explicit_finite_and_not_an_extensible_authority_document() {
        let mut request = ServiceContinuationRequest {
            execution_id: Uuid::new_v4(),
            max_restarts: 2,
            restart_window_seconds: 60,
            backoff_seconds: 1,
        };
        assert!(request.valid());
        request.max_restarts = 33;
        assert!(!request.valid());
        request.max_restarts = 2;
        request.backoff_seconds = 60;
        assert!(!request.valid());
        let mut json = serde_json::to_value(request).unwrap();
        json["reset_budget"] = true.into();
        assert!(serde_json::from_value::<ServiceContinuationRequest>(json).is_err());
    }
}

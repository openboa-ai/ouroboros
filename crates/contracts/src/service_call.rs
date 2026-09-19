//! Company operation declarations carry restrictions, never caller identity or authority.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub const SERVICE_EFFECT_SLOT_HEADER: &str = "x-ouro-effect-slot";

/// One qualified operation of an immutable submitted program. Each slot can admit one effect.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ServiceOperationPlan {
    pub name: String,
    pub effects: Vec<ServiceEffectSlot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ServiceEffectSlot {
    pub slot: String,
    pub target: String,
    pub operation: String,
    pub max_input_bytes: u32,
    /// Exact top-level values required in the child payload, in addition to target/operation.
    #[serde(default)]
    pub input_equals: BTreeMap<String, Value>,
}

/// The operation must match the selected submission. Core derives all identity and root fields.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ServiceInvocation {
    pub operation: String,
    pub input: Value,
}

pub fn service_slot_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.as_bytes()[0].is_ascii_alphanumeric()
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}

impl ServiceOperationPlan {
    pub fn valid(&self) -> bool {
        let mut slots = std::collections::BTreeSet::new();
        service_slot_name(&self.name)
            && self.effects.len() <= 32
            && self.effects.iter().all(|effect| {
                service_slot_name(&effect.slot)
                    && slots.insert(&effect.slot)
                    && !effect.target.is_empty()
                    && effect.target.len() <= 128
                    && matches!(
                        effect.operation.as_str(),
                        "db.read"
                            | "db.write"
                            | "file.read"
                            | "file.upload"
                            | "file.publish"
                            | "model.responses"
                    )
                    && (1..=2_097_152).contains(&effect.max_input_bytes)
                    && effect.input_equals.len() <= 32
                    && effect
                        .input_equals
                        .keys()
                        .all(|key| !key.is_empty() && key.len() <= 128)
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn plans_bound_unique_slots_and_do_not_accept_authority_fields() {
        let effect = ServiceEffectSlot {
            slot: "snapshot".into(),
            target: "company".into(),
            operation: "db.read".into(),
            max_input_bytes: 1024,
            input_equals: BTreeMap::new(),
        };
        let mut plan = ServiceOperationPlan {
            name: "snapshot".into(),
            effects: vec![effect.clone()],
        };
        assert!(plan.valid());
        plan.effects.push(effect.clone());
        assert!(!plan.valid());
        plan.effects = vec![effect.clone()];
        plan.effects[0].operation = "execution.start".into();
        assert!(!plan.valid());
        plan.effects[0] = effect;
        plan.effects[0].slot = "*".into();
        assert!(!plan.valid());
        assert!(
            serde_json::from_value::<ServiceInvocation>(
                json!({"operation":"snapshot","input":{},"root_intent_id":"forged"})
            )
            .is_err()
        );
        assert!(serde_json::from_value::<ServiceEffectSlot>(json!({"slot":"a","target":"db","operation":"db.read","max_input_bytes":32,"on_behalf_of":"owner"})).is_err());
    }
}

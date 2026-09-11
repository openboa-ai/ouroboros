use super::{Error, Result};
use ouroboros_contracts::ResourceReply;
use serde_json::{Value, json};
use uuid::Uuid;

/// Validate the assigned Catalog worker's observation against the admitted upload.
/// This verifies metadata, not physical presence, released holds, or cleanup authority.
/// Historical consumers must call this too; a stored UUID alone is not a valid receipt.
pub(super) fn validate(intent: Uuid, input: &Value, reply: &ResourceReply) -> Result<Option<Uuid>> {
    if intent.is_nil()
        || reply.status != 200
        || reply.content_type != "application/json"
        || input.as_object().is_none_or(|fields| fields.len() != 2)
    {
        return Err(Error::Invalid);
    }
    let digest = input["sha256"]
        .as_str()
        .filter(|digest| {
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        })
        .ok_or(Error::Invalid)?;
    let size = input["size"]
        .as_u64()
        .filter(|size| *size <= i64::MAX as u64)
        .ok_or(Error::Invalid)?;
    let object = match reply.receipt.get("object_id") {
        None => None,
        Some(value) => Some(
            value
                .as_str()
                .and_then(|value| Uuid::parse_str(value).ok())
                .filter(|id| !id.is_nil())
                .ok_or(Error::Invalid)?,
        ),
    };
    let mut expected_body = json!({"intent_id":intent,"upload_id":intent,"sha256":digest});
    let mut expected_receipt =
        json!({"source":"catalog","upload_receipt":intent,"sha256":digest,"size":size});
    if let Some(object) = object {
        expected_body["object_id"] = json!(object);
        expected_receipt["object_id"] = json!(object);
    }
    if serde_json::from_str::<Value>(&reply.body).map_err(|_| Error::Invalid)? != expected_body
        || reply.receipt != expected_receipt
    {
        return Err(Error::Invalid);
    }
    Ok(object)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_legacy_receipt_has_no_collectible_object_identity() {
        let intent = Uuid::new_v4();
        let digest = "a".repeat(64);
        let input = json!({"sha256":digest,"size":7});
        let legacy = ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: json!({"intent_id":intent,"upload_id":intent,"sha256":digest}).to_string(),
            receipt: json!({"source":"catalog","upload_receipt":intent,"sha256":digest,"size":7}),
        };
        assert_eq!(validate(intent, &input, &legacy).unwrap(), None);
        let mut explicit_null = legacy.clone();
        explicit_null.receipt["object_id"] = Value::Null;
        assert!(matches!(
            validate(intent, &input, &explicit_null),
            Err(Error::Invalid)
        ));
    }

    #[test]
    fn historical_object_id_requires_the_whole_original_receipt() {
        let intent = Uuid::new_v4();
        let object = Uuid::new_v4();
        let digest = "b".repeat(64);
        let input = json!({"sha256":digest,"size":7});
        let mut reply = ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: json!({"intent_id":intent,"upload_id":intent,"sha256":digest,"object_id":object})
                .to_string(),
            receipt: json!({"source":"catalog","upload_receipt":intent,"sha256":digest,"size":7,"object_id":object}),
        };
        assert_eq!(validate(intent, &input, &reply).unwrap(), Some(object));
        reply.receipt["size"] = json!(70);
        assert!(matches!(
            validate(intent, &input, &reply),
            Err(Error::Invalid)
        ));
        reply.receipt["size"] = json!(7);
        reply.body = "{}".into();
        assert!(matches!(
            validate(intent, &input, &reply),
            Err(Error::Invalid)
        ));
    }
}

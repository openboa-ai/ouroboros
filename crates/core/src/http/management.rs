//! Human and instance management share the authenticated caller boundary.
use super::{
    App,
    context::{Failure, caller, key},
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{
        IntoResponse, Response,
        sse::{Event, Sse},
    },
};
use ouroboros_contracts::{ExecutionRequest, RevisionRequest, WorkRequest};
use ouroboros_core::Error;
use ouroboros_transport::Peer;
use serde::Deserialize;
use std::{collections::HashMap, time::Duration};
use uuid::Uuid;

pub(super) async fn conditions(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    let mut value = a.core.conditions(&caller(&a, p, &h)?).await?;
    if a.recovery.is_some() {
        value["execution_mode"] = serde_json::json!("recovery_inspection");
        value["current_authority_verified"] = serde_json::json!(false);
    }
    Ok(Json(value))
}
pub(super) async fn work(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<WorkRequest>,
) -> Result<impl IntoResponse, Failure> {
    let v = a.core.create_work(&caller(&a, p, &h)?, key(&h)?, r).await?;
    Ok((StatusCode::OK, Json(v)))
}
pub(super) async fn start(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<ExecutionRequest>,
) -> Result<impl IntoResponse, Failure> {
    let v = a.core.start(&caller(&a, p, &h)?, key(&h)?, r).await?;
    Ok((StatusCode::ACCEPTED, Json(v)))
}
pub(super) async fn read(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((kind, id)): Path<(String, Uuid)>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(a.core.read(&caller(&a, p, &h)?, &kind, id).await?))
}
pub(super) async fn restrict(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((kind, id, action)): Path<(String, Uuid, String)>,
    h: HeaderMap,
    Json(r): Json<RevisionRequest>,
) -> Result<impl IntoResponse, Failure> {
    if !matches!(
        (kind.as_str(), action.as_str()),
        ("executions", "stop") | ("delegations", "revoke")
    ) {
        return Err(Failure(Error::NotFound));
    }
    Ok((
        StatusCode::ACCEPTED,
        Json(
            a.core
                .restrict(
                    &caller(&a, p, &h)?,
                    key(&h)?,
                    &kind,
                    id,
                    r.expected_revision,
                )
                .await?,
        ),
    ))
}
pub(super) async fn cancel_unstarted(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<RevisionRequest>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .cancel_unstarted(&caller(&a, p, &h)?, id, key(&h)?, r.expected_revision)
            .await?,
    ))
}
pub(super) async fn native_control(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::NativeControlRequest>,
) -> Result<impl IntoResponse, Failure> {
    Ok((
        StatusCode::ACCEPTED,
        Json(
            a.core
                .native_control(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn register_wake(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::WakeRequest>,
) -> Result<impl IntoResponse, Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .register_wake(caller(&a, p, &h)?, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn read_wake(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
) -> Result<impl IntoResponse, Failure> {
    Ok(Json(a.core.wake(caller(&a, p, &h)?, id).await?))
}
pub(super) async fn cancel_wake(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::WakeCancelRequest>,
) -> Result<impl IntoResponse, Failure> {
    Ok(Json(
        a.core
            .cancel_wake(caller(&a, p, &h)?, id, key(&h)?, r)
            .await?,
    ))
}
pub(super) async fn create_conversation(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::ConversationRequest>,
) -> Result<impl IntoResponse, Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .create_conversation(caller(&a, p, &h)?, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn send_message(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::MessageRequest>,
) -> Result<impl IntoResponse, Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .send_message(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn conversation_messages(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    Query(q): Query<HashMap<String, String>>,
    h: HeaderMap,
) -> Result<impl IntoResponse, Failure> {
    let cursor = q
        .get("cursor")
        .map(|v| v.parse::<i64>())
        .transpose()
        .map_err(|_| Failure(Error::Invalid))?
        .unwrap_or(0);
    Ok(Json(
        a.core
            .conversation_messages(caller(&a, p, &h)?, id, cursor)
            .await?,
    ))
}
pub(super) async fn deliver_message(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((conversation, message)): Path<(Uuid, Uuid)>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::MessageDeliveryRequest>,
) -> Result<impl IntoResponse, Failure> {
    Ok((
        StatusCode::ACCEPTED,
        Json(
            a.core
                .deliver_message(caller(&a, p, &h)?, conversation, message, r)
                .await?,
        ),
    ))
}
pub(super) async fn conversation_participant(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::ConversationParticipantRequest>,
) -> Result<impl IntoResponse, Failure> {
    Ok(Json(
        a.core
            .set_conversation_participant(caller(&a, p, &h)?, id, key(&h)?, r)
            .await?,
    ))
}
pub(super) async fn work_conversations(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
) -> Result<impl IntoResponse, Failure> {
    Ok(Json(
        a.core.work_conversations(caller(&a, p, &h)?, id).await?,
    ))
}
pub(super) async fn events(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Query(q): Query<HashMap<String, String>>,
    h: HeaderMap,
) -> Result<Response, Failure> {
    let caller = caller(&a, p, &h)?;
    let mut cursor = h
        .get("last-event-id")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
        .or_else(|| q.get("cursor").cloned())
        .ok_or(Failure(Error::Invalid))?;
    a.core.events(&caller, &cursor).await?;
    let stream = async_stream::stream! {
        for _ in 0..50 {
            match a.core.events(&caller,&cursor).await {
                Ok(events)=>for e in events {
                    let prefix=cursor.rsplit_once(':').expect("validated cursor").0;
                    cursor=format!("{prefix}:{}",e.sequence);
                    yield Ok::<_,std::convert::Infallible>(Event::default().id(&cursor).event("status").json_data(&e).expect("serializable event"));
                },
                Err(_)=>{yield Ok(Event::default().event("reauthenticate").data("fresh snapshot required"));break;}
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    };
    Ok(Sse::new(stream).into_response())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct WorkListQuery {
    cursor: Option<String>,
}
pub(super) async fn list_work(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Query(q): Query<WorkListQuery>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .list_work(caller(&a, p, &h)?, q.cursor.as_deref())
            .await?,
    ))
}

pub(super) async fn environment_status(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Path(delegation): Path<Uuid>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .environment_status(caller(&a, p, &h)?, delegation)
            .await?,
    ))
}
pub(super) async fn set_admission(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::AdmissionControlRequest>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .set_admission(caller(&a, p, &h)?, key(&h)?, r)
            .await?,
    ))
}

pub(super) async fn work_executions(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    Query(q): Query<WorkListQuery>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .work_executions(caller(&a, p, &h)?, id, q.cursor.as_deref())
            .await?,
    ))
}

pub(super) async fn work_activity(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    Query(q): Query<WorkListQuery>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .work_activity(caller(&a, p, &h)?, id, q.cursor.as_deref())
            .await?,
    ))
}

pub(super) async fn execution_stop_request(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, key)): Path<(Uuid, String)>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .execution_stop_request(caller(&a, p, &h)?, id, &key)
            .await?,
    ))
}

pub(super) async fn notifications(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Query(q): Query<WorkListQuery>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .notifications(caller(&a, p, &h)?, q.cursor.as_deref())
            .await?,
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct NotificationReadRequest {
    ids: Vec<String>,
}
pub(super) async fn read_notifications(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<NotificationReadRequest>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .read_notifications(caller(&a, p, &h)?, &r.ids)
            .await?,
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct OriginalRequestQuery {
    operation: String,
    request_key: String,
}

pub(super) async fn intent_by_request_key(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Query(q): Query<OriginalRequestQuery>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .intent_by_request_key(caller(&a, p, &h)?, &q.operation, &q.request_key)
            .await?,
    ))
}

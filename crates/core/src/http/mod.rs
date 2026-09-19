//! Binary-local HTTP composition. The library remains the sole owner of authority and state.
mod capabilities;
mod context;
mod management;
mod resources;
mod runtime;
mod service_hosts;
mod services;
mod startup;

use axum::{
    Router,
    routing::{get, post},
};
use ouroboros_core::Core;
pub(crate) use startup::run;

#[derive(Clone)]
struct App {
    core: Core,
    gateway: String,
    runtime: Option<String>,
    recovery: Option<ouroboros_transport::recovery::InspectionGate>,
}

fn router(app: App) -> Router {
    Router::new()
        .route("/service-hosts/{id}/requests", post(service_hosts::admit))
        .route("/service-hosts/self/claim", post(service_hosts::claim))
        .route(
            "/service-hosts/self/requests/{id}/reply",
            post(service_hosts::reply),
        )
        .route("/service-requests/{id}", get(service_hosts::read))
        .route("/service-continuations", post(services::register))
        .route("/service-continuations/{id}", get(services::read))
        .route("/work/{id}/service-continuations", get(services::list))
        .route(
            "/service-continuations/{id}/stop-requests/{key}",
            get(services::stop_request),
        )
        .route("/service-continuations/{id}/stop", post(services::stop))
        .route(
            "/runtime/service-continuations/reconcile",
            post(runtime::service_reconcile),
        )
        .route("/resource/workspaces/list", post(resources::workspace_list))
        .route("/resource/workspaces/{id}", post(resources::workspace_read))
        .route(
            "/resource/workspaces/{id}/publications/{publication}",
            post(resources::workspace_publication),
        )
        .route("/resource/admissions", post(resources::resource_admit))
        .route(
            "/mcp/work/{work}/delegation/{grant}",
            post(capabilities::managed_mcp).get(capabilities::managed_mcp_get),
        )
        .route(
            "/resource/company-recovery/{id}",
            post(resources::company_receipt_recovery),
        )
        .route("/notifications", get(management::notifications))
        .route("/notifications/read", post(management::read_notifications))
        .route("/environment/admission", post(management::set_admission))
        .route(
            "/environment/status/{delegation}",
            get(management::environment_status),
        )
        .route("/adapter-submissions", post(capabilities::adapter_submit))
        .route(
            "/adapter-submissions/{id}/activate",
            post(capabilities::adapter_activate),
        )
        .route(
            "/adapter-submissions/{id}/invocations",
            post(capabilities::adapter_invoke),
        )
        .route(
            "/adapter-submissions/{id}/stop",
            post(capabilities::adapter_stop),
        )
        .route(
            "/adapter-submissions/{id}/acceptances",
            post(capabilities::adapter_accept),
        )
        .route(
            "/adapter-submissions/{id}/inspect",
            post(capabilities::adapter_inspect),
        )
        .route(
            "/adapter-submissions/{id}/evaluations",
            post(capabilities::adapter_evaluate),
        )
        .route(
            "/adapter-submissions/{id}/verification-executions",
            post(capabilities::adapter_verify),
        )
        .route(
            "/connection-candidates",
            post(capabilities::connection_propose),
        )
        .route(
            "/connection-candidates/{id}/status",
            post(capabilities::connection_status),
        )
        .route(
            "/connection-candidates/{id}/stop",
            post(capabilities::connection_stop),
        )
        .route(
            "/connection-candidates/{id}/acceptances",
            post(capabilities::connection_accept),
        )
        .route(
            "/connection-candidates/{id}/activate",
            post(capabilities::connection_activate),
        )
        .route(
            "/connection-candidates/{id}/reviews",
            post(capabilities::connection_review),
        )
        .route(
            "/connection-candidates/{id}/inspect",
            post(capabilities::connection_inspect),
        )
        .route(
            "/resource/credential-recovery/{id}",
            post(resources::credential_receipt_recovery),
        )
        .route(
            "/resource/credential-transfers/{id}/access",
            post(resources::credential_transfer_access),
        )
        .route(
            "/resource/collections/{id}/advance",
            post(resources::collection_advance),
        )
        .route(
            "/resource/collections/{id}/steps/{step}/claim",
            post(resources::collection_claim),
        )
        .route(
            "/resource/collections/{id}/steps/{step}/dispatch",
            post(resources::collection_dispatch),
        )
        .route(
            "/resource/collections/{id}/steps/{step}/observe",
            post(resources::collection_observe),
        )
        .route("/resource/lookup/{id}", post(resources::resource_lookup))
        .route("/resource/claims/{id}", post(resources::resource_claim))
        .route("/resource/live/{id}", post(resources::resource_live))
        .route(
            "/resource/model-transfers/{id}/access",
            post(resources::model_transfer_access),
        )
        .route(
            "/resource/transfers/{id}/access",
            post(resources::resource_transfer_access),
        )
        .route(
            "/resource/uploads/{id}",
            post(resources::resource_upload_ready),
        )
        .route(
            "/resource/completions/{id}",
            post(resources::resource_complete),
        )
        .route(
            "/resource/provider-recovery/{id}",
            post(resources::provider_receipt_recovery),
        )
        .route(
            "/resource/receipt-recovery/{id}",
            post(resources::resource_receipt_recovery),
        )
        .route("/runtime/pending", get(runtime::runtime_pending))
        .route(
            "/runtime/executions/{id}/native-controls",
            get(runtime::native_pending),
        )
        .route(
            "/runtime/native-controls/{id}/{action}",
            post(runtime::native_dispatch),
        )
        .route(
            "/runtime/input-reads/{index}",
            post(resources::program_input_admit),
        )
        .route("/runtime/history/{id}", get(runtime::runtime_history))
        .route(
            "/runtime/claims/{id}",
            post(runtime::runtime_claim).get(runtime::runtime_claim_observation),
        )
        .route("/runtime/executions/{id}", get(runtime::runtime_permitted))
        .route(
            "/runtime/executions/{id}/{action}",
            post(runtime::runtime_change),
        )
        .route(
            "/executions/{id}/native-controls",
            post(management::native_control),
        )
        .route(
            "/executions/{id}/cancel-unstarted",
            post(management::cancel_unstarted),
        )
        .route(
            "/work/{id}/conversations",
            get(management::work_conversations),
        )
        .route("/conversations", post(management::create_conversation))
        .route(
            "/conversations/{id}/participants",
            post(management::conversation_participant),
        )
        .route(
            "/conversations/{conversation}/messages/{message}/deliver",
            post(management::deliver_message),
        )
        .route(
            "/conversations/{id}/messages",
            get(management::conversation_messages).post(management::send_message),
        )
        .route("/wakes", post(management::register_wake))
        .route("/wakes/{id}", get(management::read_wake))
        .route("/wakes/{id}/cancel", post(management::cancel_wake))
        .route("/conditions", get(management::conditions))
        .route(
            "/intents/by-request-key",
            get(management::intent_by_request_key),
        )
        .route(
            "/executions/{id}/stop-requests/{key}",
            get(management::execution_stop_request),
        )
        .route("/work", get(management::list_work).post(management::work))
        .route("/work/{id}/executions", get(management::work_executions))
        .route("/work/{id}/activity", get(management::work_activity))
        .route("/executions", post(management::start))
        .route("/events", get(management::events))
        .route("/{kind}/{id}", get(management::read))
        .route("/{kind}/{id}/{action}", post(management::restrict))
        .layer(axum::extract::DefaultBodyLimit::max(3 * 1024 * 1024))
        .layer(axum::middleware::from_fn_with_state(
            app.clone(),
            context::recovery_boundary,
        ))
        .with_state(app)
}

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SandboxAdapter } from "@ouroboros/adapters/sandbox/adapter";
import type {
  GatewayRuntimeBinding,
  PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import type { ReplayTradingApiProviderSession } from "@ouroboros/application/trading/research/types";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { OUROBOROS_COMMAND_KINDS } from "@ouroboros/domain";
import { buildServer, paperTradingApiProviderNetworkOptions } from "../src/server";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

let paperProviderSequence = 0;

function buildRuntimeTestServer(options: Parameters<typeof buildServer>[0]) {
  return buildServer({
    paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
    ...options
  });
}

describe("runtime canonical operator API", () => {
  it("binds the paper runtime provider to a sandbox-reachable interface when sandbox host is configured", () => {
    expect(paperTradingApiProviderNetworkOptions({
      sandboxHost: "host.docker.internal"
    })).toEqual({
      listen_host: "0.0.0.0",
      sandbox_host: "host.docker.internal"
    });
    expect(paperTradingApiProviderNetworkOptions({ sandboxHost: "  " })).toEqual({});
    expect(paperTradingApiProviderNetworkOptions({})).toEqual({});
  });

  it("serves health, operator state, resource reads, and no removed public routes", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });

    try {
      const health = await server.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({
        status: "ok",
        service: "ouroboros-runtime",
        trading_gateway_environment: {
          authority_status: "not_live"
        }
      });

      const gateway = await server.inject({ method: "GET", url: "/api/gateway/environment" });
      expect(gateway.statusCode).toBe(200);
      expect(gateway.json()).toMatchObject({
        trading_gateway_environment: {
          runtime_environment: "paper",
          live_exchange_authority: false,
          order_submission_authority: false,
          authority_status: "not_live"
        }
      });

      const executionModeContracts = await server.inject({
        method: "GET",
        url: "/api/trading-system/execution-mode-contracts"
      });
      expect(executionModeContracts.statusCode).toBe(200);
      expect(executionModeContracts.json()).toMatchObject({
        trading_system_execution_mode_contracts: [
          expect.objectContaining({
            mode: "backtest",
            authority: expect.objectContaining({
              status: "not_live"
            })
          }),
          expect.objectContaining({
            mode: "paper",
            authority: expect.objectContaining({
              status: "paper_only"
            })
          }),
          expect.objectContaining({
            mode: "live",
            authority: expect.objectContaining({
              status: "live_disabled"
            })
          })
        ]
      });

      const operator = await server.inject({ method: "GET", url: "/api/operator" });
      expect(operator.statusCode).toBe(200);
      expect(operator.json()).toMatchObject({
        operator: {
          command_descriptors: expect.arrayContaining(
            OUROBOROS_COMMAND_KINDS.map((commandKind) => expect.objectContaining({
              command_kind: commandKind
            }))
          ),
          candidate_arena: {
            runner_status: "stopped",
            authority_status: "not_live"
          },
          selected_candidate_id: null,
          live_disabled: true,
          authority_status: "not_live"
        }
      });

      const candidates = await server.inject({ method: "GET", url: "/api/candidates" });
      expect(candidates.statusCode).toBe(200);
      expect(candidates.json().candidates.map((candidate: { candidate_id: string }) => candidate.candidate_id))
        .toContain(FIXTURE_CANDIDATE_ID);

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        ledger: {
          has_activity: false
        }
      });

      const evaluations = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluations`
      });
      expect(evaluations.statusCode).toBe(200);
      expect(evaluations.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        evaluations: expect.any(Array)
      });

      for (const url of [
        "/api/candidate-arena",
        `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
        "/api/candidate-generation-runs",
        "/api/candidate-materialization-attempts",
        "/api/trading-gateway/environment",
        "/api/trading-research/runtime"
      ]) {
        const response = await server.inject({ method: "GET", url });
        expect(response.statusCode).toBe(404);
      }
    } finally {
      await server.close();
    }
  });

  it("runs user mutations through /api/commands and reflects them in /api/operator", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      marketDataPort: fakeGatewayMarketDataPort()
    });

    try {
      const status = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: { command_kind: "arena.status" }
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        command: {
          command_kind: "arena.status",
          status: "succeeded"
        },
        operator: {
          candidate_arena: {
            authority_status: "not_live"
          }
        }
      });

      const selected = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(selected.statusCode).toBe(200);
      expect(selected.json()).toMatchObject({
        command: {
          command_kind: "candidate.select",
          status: "succeeded"
        },
        operator: {
          selected_candidate_id: FIXTURE_CANDIDATE_ID,
          selected_candidate: {
            candidate_id: FIXTURE_CANDIDATE_ID
          },
          selected_paper_evidence: {
            status: "not_run",
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: {
            status: "not_started",
            observation_count: 0,
            authority_status: "not_live"
          }
        }
      });

      const evidence = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(evidence.statusCode, evidence.body).toBe(200);
      expect(evidence.json()).toMatchObject({
        command: {
          command_kind: "trading_run.start",
          status: "succeeded"
        },
        operator: {
          selected_candidate_id: FIXTURE_CANDIDATE_ID,
          selected_paper_trading_evaluation: {
            status: "running",
            observation_count: 1,
            authority_status: "not_live"
          }
        }
      });

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID
      });
    } finally {
      await server.close();
    }
  });

  it("serves candidates and operator state when the candidate projection index is missing", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });

    try {
      await rm(path.join(tmpDir, "read-models/candidates/index.json"), { force: true });

      const candidates = await server.inject({ method: "GET", url: "/api/candidates" });
      expect(candidates.statusCode).toBe(200);
      expect(candidates.json().candidates.map((candidate: { candidate_id: string }) => candidate.candidate_id))
        .toContain(FIXTURE_CANDIDATE_ID);

      const operator = await server.inject({ method: "GET", url: "/api/operator" });
      expect(operator.statusCode).toBe(200);
      expect(operator.json()).toMatchObject({
        operator: {
          candidate_arena: {
            runner_status: "stopped"
          },
          live_disabled: true,
          authority_status: "not_live"
        }
      });
    } finally {
      await server.close();
    }
  });

  it("restarts the sandbox with a fresh provider URL when resuming an inactive paper run", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const firstSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const firstServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: firstSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: {
            candidate_id: FIXTURE_CANDIDATE_ID,
            paper_order_request: "rejected"
          }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(firstSandbox.starts).toHaveLength(1);
      expect(firstSandbox.starts[0]?.paper_order_request).toBe("rejected");
      expect(firstSandbox.starts[0]?.env?.TRADING_API_BASE_URL).toBeUndefined();
    } finally {
      await firstServer.close();
    }

    const resumedSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const resumedServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: resumedSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const resumed = await resumedServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(resumed.statusCode, resumed.body).toBe(200);
      expect(resumed.json()).toMatchObject({
        command: {
          command_kind: "trading_run.start",
          status: "succeeded"
        }
      });
      expect(resumedSandbox.starts).toHaveLength(1);
      expect(resumedSandbox.starts[0]?.paper_order_request).toBe("rejected");
      expect(resumedSandbox.starts[0]?.env?.TRADING_API_BASE_URL).toBeUndefined();
      expect(resumedSandbox.starts[0]?.instance_id).toBe(firstSandbox.starts[0]?.instance_id);
    } finally {
      await resumedServer.close();
    }
  });

  it("does not restart a stopped paper session from observe after runtime close", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const firstSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const firstServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: firstSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });
    let tradingRunId = "";

    try {
      const started = await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      expect(firstSandbox.starts).toHaveLength(1);
    } finally {
      await firstServer.close();
    }

    const observedSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const observedServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: observedSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const observed = await observedServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        command: {
          command_kind: "trading_run.observe",
          status: "succeeded"
        },
        operator: {
          selected_paper_trading_evaluation: {
            runner_active: false
          }
        }
      });
      expect(observedSandbox.starts).toHaveLength(0);
    } finally {
      await observedServer.close();
    }
  });

  it("keeps resumed sandbox event ids stable when TradingSystem events derive from instance id", async () => {
    const store = new LocalStore(tmpDir);
    const orderLineForInstance = (input: TestSandboxStartInput) => paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001",
      eventId: `${input.instance_id}:order-request:0001`,
      instanceId: input.instance_id,
      orderType: "market"
    });
    const firstSandbox = recordingDuplicateLogSandboxAdapter(orderLineForInstance);
    const firstServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: firstSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const started = await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(firstSandbox.starts).toHaveLength(1);
    } finally {
      await firstServer.close();
    }

    const resumedSandbox = recordingDuplicateLogSandboxAdapter(orderLineForInstance);
    const resumedServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: resumedSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const resumed = await resumedServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(resumed.statusCode, resumed.body).toBe(200);
      expect(resumedSandbox.starts).toHaveLength(1);
      expect(resumedSandbox.starts[0]?.instance_id).toBe(firstSandbox.starts[0]?.instance_id);
      expect(resumed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 2,
            latest_decision: {
              decision_kind: "order_request",
              reason: "trading_system_order_request"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long"
              }
            }
          }
        }
      });

      const evaluationId = resumed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[0]?.processed_trading_system_event_ids).toHaveLength(1);
      expect(observations[1]?.status).toBe("no_order");
      expect(observations[1]?.processed_trading_system_event_ids).toEqual(
        observations[0]?.processed_trading_system_event_ids
      );
    } finally {
      await resumedServer.close();
    }
  });

  it("consumes TradingSystem order events once and records fake account state", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 66_000,
            moving_average_fast: 66_025,
            moving_average_slow: 65_975,
            observed_at: "2026-05-16T00:01:03.000Z"
          }
        ],
        executionSnapshots: [
          {
            observed_at: "2026-05-16T00:00:03.000Z",
            agg_trades: [{
              trade_id: "agg-60000-001",
              price: "60000",
              quantity: "0.001",
              trade_time: "2026-05-16T00:00:03.500Z"
            }]
          },
          {
            observed_at: "2026-05-16T00:01:03.000Z",
            agg_trades: []
          }
        ]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });

      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 1,
            latest_market_snapshot: {
              price: 65_000
            },
            latest_decision: {
              decision_kind: "order_request",
              order_request: {
                side: "buy",
                limit_price: "60000"
              },
              authority_status: "trace_only"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long",
                average_entry_price: "60000"
              },
              open_order_count: 0
            },
            latest_fill: {
              fill_status: "filled",
              fill_price: "60000",
              fill_quantity: "0.001"
            }
          }
        }
      });

      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 2,
            latest_market_snapshot: {
              price: 66_000
            },
            latest_decision: {
              decision_kind: "order_request",
              reason: "trading_system_order_request",
              authority_status: "trace_only"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long",
                average_entry_price: "60000",
                mark_price: "66000"
              },
              open_order_count: 0
            }
          }
        }
      });

      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        decision?: {
          decision_kind: string;
          order_request?: {
            limit_price?: string;
          };
        };
        ledger_ref?: { id: string };
        processed_trading_system_event_ids?: string[];
        paper_account_snapshot?: {
          position: {
            quantity: string;
            side: string;
          };
        };
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[0]?.decision?.order_request?.limit_price).toBe("60000");
      expect(observations[0]?.paper_account_snapshot?.position).toMatchObject({
        quantity: "0.001",
        side: "long"
      });
      expect(observations[0]?.processed_trading_system_event_ids).toHaveLength(1);
      expect(observations[1]?.status).toBe("no_order");
      expect(observations[1]?.decision).toBeUndefined();
      expect(observations[1]?.ledger_ref).toBeUndefined();
      expect(observations[1]?.processed_trading_system_event_ids).toEqual(
        observations[0]?.processed_trading_system_event_ids
      );
    } finally {
      await server.close();
    }
  });

  it("does not replay the same TradingSystem log line when sandbox log refs change", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 66_000,
            moving_average_fast: 66_025,
            moving_average_slow: 65_975,
            observed_at: "2026-05-16T00:01:03.000Z"
          }
        ],
        executionSnapshots: [
          {
            observed_at: "2026-05-16T00:00:03.000Z",
            agg_trades: [{
              trade_id: "agg-first-fill",
              price: "60000",
              quantity: "0.001",
              trade_time: "2026-05-16T00:00:03.500Z"
            }]
          },
          {
            observed_at: "2026-05-16T00:01:03.000Z",
            agg_trades: [{
              trade_id: "agg-would-fill-replayed-order",
              price: "60000",
              quantity: "0.001",
              trade_time: "2026-05-16T00:01:03.500Z"
            }]
          }
        ]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);

      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 2,
            latest_decision: {
              decision_kind: "order_request",
              reason: "trading_system_order_request"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long"
              }
            }
          }
        }
      });
      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[1]?.status).toBe("no_order");
      expect(observations[1]?.processed_trading_system_event_ids).toEqual(
        observations[0]?.processed_trading_system_event_ids
      );

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json().ledger.chains).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it("records residual bookTicker-only market fills as paper observations", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      orderType: "market",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 66_000,
            moving_average_fast: 66_025,
            moving_average_slow: 65_975,
            observed_at: "2026-05-16T00:01:03.000Z"
          }
        ],
        executionSnapshots: [
          {
            observed_at: "2026-05-16T00:00:03.000Z",
            book_ticker: {
              bid_price: "64999",
              bid_quantity: "1.000",
              ask_price: "65001",
              ask_quantity: "0.0004",
              event_time: "2026-05-16T00:00:03.500Z"
            }
          },
          {
            observed_at: "2026-05-16T00:01:03.000Z",
            book_ticker: {
              bid_price: "65999",
              bid_quantity: "1.000",
              ask_price: "66001",
              ask_quantity: "0.0006",
              event_time: "2026-05-16T00:01:03.500Z"
            }
          }
        ]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);

      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        latest_fill?: unknown;
        paper_account_snapshot?: {
          position: { quantity: string };
        };
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[1]?.status, JSON.stringify(observations, null, 2)).toBe("recorded");
      expect(observations[1]?.paper_account_snapshot?.position.quantity).toBe("0.001");
    } finally {
      await server.close();
    }
  });

  it("applies cancel-only TradingSystem events without requiring public fill evidence", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const cancelLine = paperCancelOrderLine("2026-05-16T00:01:03.000Z");
    const marketDataPort = fakeGatewayMarketDataPort({
      snapshots: [
        {
          price: 65_000,
          moving_average_fast: 65_025,
          moving_average_slow: 64_975,
          observed_at: "2026-05-16T00:00:03.000Z"
        },
        {
          price: 66_000,
          moving_average_fast: 66_025,
          moving_average_slow: 65_975,
          observed_at: "2026-05-16T00:01:03.000Z"
        }
      ],
      executionSnapshots: [{
        observed_at: "2026-05-16T00:00:03.000Z",
        agg_trades: []
      }]
    });
    const originalExecutionSnapshot = marketDataPort.readPublicExecutionSnapshot.bind(marketDataPort);
    let executionSnapshotReadCount = 0;
    marketDataPort.readPublicExecutionSnapshot = async (request) => {
      executionSnapshotReadCount += 1;
      if (executionSnapshotReadCount > 1) {
        throw new Error("cancel-only checkpoint should not read public execution stream");
      }
      return originalExecutionSnapshot(request);
    };
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningOrderThenCancelLogSandboxAdapter(orderLine, cancelLine)
      },
      marketDataPort,
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json().operator.selected_paper_trading_evaluation.open_orders).toHaveLength(1);

      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(executionSnapshotReadCount).toBe(1);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            status: "running",
            observation_count: 2,
            latest_decision: {
              decision_kind: "cancel_order"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0",
                side: "flat"
              },
              open_order_count: 0
            },
            open_orders: []
          }
        }
      });

      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        decision?: { decision_kind: string };
        open_orders?: unknown[];
        public_execution_snapshot?: unknown;
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[1]).toMatchObject({
        status: "recorded",
        decision: { decision_kind: "cancel_order" },
        open_orders: []
      });
      expect(observations[1]?.public_execution_snapshot).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it("fails observation when public execution stream evidence is unavailable and leaves events retryable", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        failPublicExecutionSnapshot: true
      })
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            ledger_chain_complete: true,
            latest_decision: {
              decision_kind: "order_request",
              authority_status: "trace_only"
            },
            latest_failure_reason: "fake public execution stream unavailable"
          }
        }
      });
      const evaluationId = started.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        decision?: { decision_kind: string };
        failure_reason?: string;
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({
        status: "failed",
        decision: { decision_kind: "order_request" },
        failure_reason: "fake public execution stream unavailable",
        processed_trading_system_event_ids: []
      });
    } finally {
      await server.close();
    }
  });

  it("records risk-rejected TradingSystem orders without fake account mutation", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(paperOrderRequestLine({
          at: "2026-05-16T00:00:03.000Z",
          quantity: "0"
        }))
      },
      marketDataPort: fakeGatewayMarketDataPort({
        failPublicExecutionSnapshot: true
      })
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: {
            candidate_id: FIXTURE_CANDIDATE_ID,
            paper_order_request: "rejected"
          }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 1,
            latest_gateway_outcome: "rejected",
            latest_execution_status: "blocked",
            paper_account_snapshot: {
              equity_usdt: "10000",
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });
      const evaluationId = started.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        processed_trading_system_event_ids?: string[];
        paper_account_snapshot?: {
          equity_usdt: string;
          position: {
            side: string;
            quantity: string;
          };
        };
      }>;
      expect(observations[0]?.processed_trading_system_event_ids).toHaveLength(1);
      expect(observations[0]?.paper_account_snapshot).toMatchObject({
        equity_usdt: "10000",
        position: {
          side: "flat",
          quantity: "0"
        }
      });
    } finally {
      await server.close();
    }
  });

  it("rejects private or live TradingSystem paper events without Ledger or fake account mutation", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(paperLiveAuthorityAttemptLine())
      },
      marketDataPort: fakeGatewayMarketDataPort({
        failPublicExecutionSnapshot: true
      })
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            ledger_chain_complete: false,
            latest_decision: {
              decision_kind: "error",
              reason: "forbidden_private_or_live_authority",
              authority_status: "trace_only"
            },
            latest_failure_reason: "forbidden_private_or_live_authority",
            paper_account_snapshot: {
              equity_usdt: "10000",
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });
      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json().ledger.has_activity).toBe(false);

      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: {
            trading_run_id: started.json().operator.selected_paper_trading_evaluation.trading_run_id
          }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            latest_failure_reason: "forbidden_private_or_live_authority"
          }
        }
      });

      const restarted = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(restarted.statusCode, restarted.body).toBe(409);
      expect(restarted.json()).toMatchObject({
        error: "paper_trading_evaluation_failed_requires_repair",
        status: "failed_requires_repair",
        paper_trading_evaluation: {
          status: "failed",
          observation_count: 1,
          latest_failure_reason: "forbidden_private_or_live_authority"
        },
        operator: {
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            latest_failure_reason: "forbidden_private_or_live_authority"
          }
        }
      });
    } finally {
      await server.close();
    }
  });

  it("aborts a mixed paper event batch after a protocol error before Ledger or account mutation", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildRuntimeTestServer({
      store,
      marketDataPort: fakeGatewayMarketDataPort(),
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter([
          paperLiveAuthorityAttemptLine(),
          paperOrderRequestLine({
            at: "2026-05-16T00:00:04.000Z",
            quantity: "0.001"
          })
        ])
      }
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            latest_failure_reason: "forbidden_private_or_live_authority",
            paper_account_snapshot: {
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json().ledger.has_activity).toBe(false);

      const evaluationId = started.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations[0]?.processed_trading_system_event_ids).toEqual([
        "paper-runtime-live-authority-attempt"
      ]);

      const observedAgain = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: {
            trading_run_id: started.json().operator.selected_paper_trading_evaluation.trading_run_id
          }
        }
      });
      expect(observedAgain.statusCode, observedAgain.body).toBe(200);
      expect(observedAgain.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            latest_failure_reason: "forbidden_private_or_live_authority",
            paper_account_snapshot: {
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });

      const candidateAfterRetry = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidateAfterRetry.statusCode, candidateAfterRetry.body).toBe(200);
      expect(candidateAfterRetry.json().ledger.has_activity).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("runs candidate evaluation through the command endpoint and exposes evaluation resources", async () => {
    const server = await buildRuntimeTestServer({ store: new LocalStore(tmpDir) });

    try {
      const created = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.evaluation.run",
          payload: {
            candidate_id: FIXTURE_CANDIDATE_ID,
            idempotency_key: "runtime-test-canonical-evaluation"
          }
        }
      });
      expect(created.statusCode, created.body).toBe(200);
      expect(created.json()).toMatchObject({
        command: {
          command_kind: "candidate.evaluation.run",
          status: "succeeded"
        }
      });

      const evaluationId = created.json().result.evaluation.evaluation_run.evaluation_run_record_id;
      const evaluation = await server.inject({
        method: "GET",
        url: `/api/evaluations/${evaluationId}`
      });
      expect(evaluation.statusCode).toBe(200);
      expect(evaluation.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        evaluation_run: {
          evaluation_run_record_id: evaluationId
        }
      });
    } finally {
      await server.close();
    }
  });
});

function paperOrderRequestLine(input: {
  at: string;
  quantity: string;
  eventId?: string;
  instanceId?: string;
  orderType?: "limit" | "market";
}): string {
  const orderType = input.orderType ?? "limit";
  return JSON.stringify({
    at: input.at,
    authority_status: "trace_only",
    event: "order_request",
    event_id: input.eventId ?? `paper-runtime-${orderType}-order-${input.at.replace(/[^0-9]/g, "")}`,
    instance_id: input.instanceId ?? "paper-runtime-fixture",
    intent_kind: "place_order",
    ...(orderType === "limit" ? { limit_price: "60000" } : {}),
    order_type: orderType,
    quantity: input.quantity,
    side: "buy",
    symbol: "BTCUSDT"
  });
}

function paperCancelOrderLine(at: string): string {
  return JSON.stringify({
    at,
    authority_status: "trace_only",
    event: "cancel_order",
    event_id: "paper-runtime-cancel-open-order",
    instance_id: "paper-runtime-fixture",
    reason: "operator_stop_loss"
  });
}

function paperLiveAuthorityAttemptLine(): string {
  return JSON.stringify({
    at: "2026-05-16T00:00:03.000Z",
    authority_status: "trace_only",
    event: "order_request",
    event_id: "paper-runtime-live-authority-attempt",
    instance_id: "paper-runtime-fixture",
    intent_kind: "place_order",
    limit_price: "60000",
    order_type: "limit",
    quantity: "0.001",
    runtime_environment: "live",
    side: "buy",
    signed_request: true,
    symbol: "BTCUSDT"
  });
}

type TestSandboxStartInput = Parameters<SandboxAdapter["startArtifactInstance"]>[0];
type TestSandboxLinesInput = string | string[] | ((input: TestSandboxStartInput) => string | string[]);

function recordingDuplicateLogSandboxAdapter(orderLines: TestSandboxLinesInput): {
  adapter: SandboxAdapter;
  starts: TestSandboxStartInput[];
} {
  const starts: TestSandboxStartInput[] = [];
  const adapter = runningDuplicateLogSandboxAdapter(orderLines);
  return {
    starts,
    adapter: {
      ...adapter,
      async startArtifactInstance(input) {
        starts.push(input);
        return adapter.startArtifactInstance(input);
      }
    }
  };
}

function runningDuplicateLogSandboxAdapter(orderLines: TestSandboxLinesInput): SandboxAdapter {
  let refreshCount = 0;
  const linesBySandboxId = new Map<string, string[]>();
  return {
    kind: "deterministic_test",
    async startArtifactInstance(input) {
      const lines = resolveTestSandboxLines(orderLines, input);
      linesBySandboxId.set(input.instance_id, lines);
      const sandboxRef = { record_kind: "sandbox", id: input.instance_id };
      const placementRef = { record_kind: "sandbox_placement", id: input.sandbox_placement_id };
      const capturedAt = input.created_at;
      return {
        placement: {
          record_kind: "sandbox_placement",
          version: 1,
          sandbox_placement_id: input.sandbox_placement_id,
          placement_kind: "fixture_local_placeholder",
          authority_status: "not_launched"
        },
        instance: {
          record_kind: "sandbox",
          version: 1,
          sandbox_id: input.instance_id,
          adapter_kind: "deterministic_test",
          system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
          runtime_ref: input.runtime_ref,
          sandbox_placement_ref: placementRef,
          lifecycle_status: "running",
          sandbox_name: input.sandbox_name,
          created_at: input.created_at,
          started_at: input.created_at,
          log_refs: [{ record_kind: "sandbox_log", id: `sandbox-log-${input.instance_id}-start` }],
          heartbeat_refs: [],
          command_evidence_refs: [],
          authority_status: "not_live"
        },
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${input.instance_id}-start`,
          sandbox_ref: sandboxRef,
          lines,
          captured_at: capturedAt,
          authority_status: "trace_only"
        }],
        heartbeats: [],
        command_evidence: []
      };
    },
    async getArtifactInstanceStatus() {
      return {};
    },
    async getArtifactInstanceLogs(instance) {
      refreshCount += 1;
      const sandboxId = instance.sandbox_id;
      const lines = linesBySandboxId.get(sandboxId) ?? [];
      return {
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${sandboxId}-refresh-${refreshCount}`,
          sandbox_ref: { record_kind: "sandbox", id: sandboxId },
          lines,
          captured_at: `2026-05-16T00:0${refreshCount}:03.000Z`,
          authority_status: "trace_only"
        }]
      };
    },
    async stopArtifactInstance(instance) {
      return {
        lifecycle_status: "stopped",
        stopped_at: instance.stopped_at ?? "2026-05-16T00:02:03.000Z"
      };
    }
  };
}

function resolveTestSandboxLines(
  orderLines: TestSandboxLinesInput,
  input: TestSandboxStartInput
): string[] {
  const value = typeof orderLines === "function" ? orderLines(input) : orderLines;
  return Array.isArray(value) ? value : [value];
}

function runningOrderThenCancelLogSandboxAdapter(orderLine: string, cancelLine: string): SandboxAdapter {
  let refreshCount = 0;
  return {
    kind: "deterministic_test",
    async startArtifactInstance(input) {
      const sandboxRef = { record_kind: "sandbox", id: input.instance_id };
      const placementRef = { record_kind: "sandbox_placement", id: input.sandbox_placement_id };
      const capturedAt = input.created_at;
      return {
        placement: {
          record_kind: "sandbox_placement",
          version: 1,
          sandbox_placement_id: input.sandbox_placement_id,
          placement_kind: "fixture_local_placeholder",
          authority_status: "not_launched"
        },
        instance: {
          record_kind: "sandbox",
          version: 1,
          sandbox_id: input.instance_id,
          adapter_kind: "deterministic_test",
          system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
          runtime_ref: input.runtime_ref,
          sandbox_placement_ref: placementRef,
          lifecycle_status: "running",
          sandbox_name: input.sandbox_name,
          created_at: input.created_at,
          started_at: input.created_at,
          log_refs: [{ record_kind: "sandbox_log", id: `sandbox-log-${input.instance_id}-start` }],
          heartbeat_refs: [],
          command_evidence_refs: [],
          authority_status: "not_live"
        },
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${input.instance_id}-start`,
          sandbox_ref: sandboxRef,
          lines: [orderLine],
          captured_at: capturedAt,
          authority_status: "trace_only"
        }],
        heartbeats: [],
        command_evidence: []
      };
    },
    async getArtifactInstanceStatus() {
      return {};
    },
    async getArtifactInstanceLogs(instance) {
      refreshCount += 1;
      const sandboxId = instance.sandbox_id;
      return {
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${sandboxId}-refresh-${refreshCount}`,
          sandbox_ref: { record_kind: "sandbox", id: sandboxId },
          lines: refreshCount === 1 ? [orderLine] : [orderLine, cancelLine],
          captured_at: `2026-05-16T00:0${refreshCount}:03.000Z`,
          authority_status: "trace_only"
        }]
      };
    },
    async stopArtifactInstance(instance) {
      return {
        lifecycle_status: "stopped",
        stopped_at: instance.stopped_at ?? "2026-05-16T00:02:03.000Z"
      };
    }
  };
}

async function networklessPaperTradingApiProvider(
  binding: GatewayRuntimeBinding,
  options: PaperTradingApiProviderOptions
): Promise<ReplayTradingApiProviderSession> {
  paperProviderSequence += 1;
  const market = await binding.marketData.readMarketSnapshot();
  const account = options.readAccountState
    ? await options.readAccountState()
    : binding.account.provider_kind === "fake_paper_account"
      ? binding.account.state
      : {
          equity: 10_000,
          max_position_notional: 350,
          max_risk_fraction: 0.03,
          target_risk_fraction: 0.02
        };
  return {
    base_url: "",
    sandbox_base_url: "",
    close: async () => undefined,
    requests: () => [],
    scenario: {
      id: `networkless-paper-provider-${paperProviderSequence}`,
      description: "Networkless paper runtime provider used by runtime controller tests.",
      market,
      account,
      outcome: {
        exit_price: market.price,
        fee_bps: 4,
        slippage_bps: 3,
        funding_bps: 1
      }
    }
  };
}

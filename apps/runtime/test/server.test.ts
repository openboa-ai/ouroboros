import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { OUROBOROS_COMMAND_KINDS } from "@ouroboros/domain";
import { buildServer } from "../src/server";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("runtime canonical operator API", () => {
  it("serves health, operator state, resource reads, and no removed public routes", async () => {
    const server = await buildServer({
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
    const server = await buildServer({
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
            ledger_chain_complete: true,
            authority_status: "not_live"
          },
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
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
        ledger: {
          has_activity: true,
          chain_complete: true
        }
      });
    } finally {
      await server.close();
    }
  });

  it("consumes TradingSystem order events once and records fake account state", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
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
              trade_id: "agg-60000-001",
              price: "60000",
              quantity: "0.001",
              trade_time: "2026-05-16T00:00:02.500Z"
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
              decision_kind: "hold",
              reason: "no_new_trading_system_event",
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
      expect(observations[1]?.decision?.decision_kind).toBe("hold");
      expect(observations[1]?.ledger_ref).toBeUndefined();
      expect(observations[1]?.processed_trading_system_event_ids).toEqual(
        observations[0]?.processed_trading_system_event_ids
      );
    } finally {
      await server.close();
    }
  });

  it("fails observation when public execution stream evidence is unavailable and leaves events retryable", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
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
            ledger_chain_complete: false
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            ledger_chain_complete: false,
            latest_failure_reason: "fake public execution stream unavailable"
          }
        }
      });
      const evaluationId = started.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        failure_reason?: string;
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({
        status: "failed",
        failure_reason: "fake public execution stream unavailable",
        processed_trading_system_event_ids: []
      });
    } finally {
      await server.close();
    }
  });

  it("records risk-rejected TradingSystem orders without fake account mutation", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
      marketDataPort: fakeGatewayMarketDataPort()
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

  it("runs candidate evaluation through the command endpoint and exposes evaluation resources", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

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

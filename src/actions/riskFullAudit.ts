/**
 * Action: hyperd.risk.full_audit (synthesis tier)
 *
 * Calls GET /api/risk/full_audit — a composed endpoint that fans out
 * to balance, wallet risk, persona, contract audit, and mixer-adjacency, then
 * passes all results through claude-haiku-4-5 to produce a single verdict.
 * Cost: $0.35 in USDC on Base.
 *
 * Activated when the user asks for a full / deep / composed risk audit of an
 * EVM address, or asks for a one-shot verdict on whether a wallet is safe.
 */

import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { HyperdClient, HyperdRequestError } from "../client.js";
import { resolveConfig } from "../config.js";
import type { VerdictEnvelope } from "../types.js";

const ADDR_RE = /0x[a-fA-F0-9]{40}/;

function extractAddress(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.match(ADDR_RE);
  return m ? m[0] : null;
}

export const riskFullAuditAction: Action = {
  name: "HYPERD_RISK_FULL_AUDIT",
  description:
    "Composed wallet risk audit ($0.35). Fans out to balance + sanctions + persona + contract audit + mixer-adjacency, then produces a single LLM verdict with a risk band (safe / moderate / elevated / critical). Use when the user wants a comprehensive, one-shot risk assessment of an EVM address.",
  similes: [
    "FULL_WALLET_AUDIT",
    "COMPOSED_WALLET_RISK",
    "DEEP_WALLET_AUDIT",
    "COMPREHENSIVE_WALLET_CHECK",
    "WALLET_FULL_AUDIT",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    return extractAddress(message?.content?.text) !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ) => {
    const address = extractAddress(message?.content?.text);
    if (!address) {
      await callback?.({
        text: "I couldn't find an EVM address (0x...) in the message to audit.",
        source: "hyperd",
      });
      return { success: false };
    }

    let client: HyperdClient;
    try {
      client = new HyperdClient(resolveConfig(runtime));
    } catch (err) {
      await callback?.({
        text: `hyperD plugin misconfigured: ${err instanceof Error ? err.message : String(err)}`,
        source: "hyperd",
      });
      return { success: false };
    }

    try {
      const res = await client.get<VerdictEnvelope>("/api/risk/full_audit", { address });
      const v = res.verdict;
      const lines = [
        `Full risk audit for ${address}:`,
        `• Band: ${v.band}`,
        `• ${v.summary}`,
        `• Confidence: ${(v.confidence * 100).toFixed(0)}%`,
        `• Coverage: ${res.coverage.sub_calls_succeeded}/${res.coverage.sub_calls_attempted} sub-calls`,
        `• Model: ${res.methodology.model}`,
      ];
      if (res.coverage.sub_calls_failed.length > 0) {
        lines.push(`• Partial data — failed: ${res.coverage.sub_calls_failed.map((f) => f.id).join(", ")}`);
      }
      await callback?.({
        text: lines.join("\n"),
        source: "hyperd",
        action: "HYPERD_RISK_FULL_AUDIT",
        content: res,
      });
      return { success: true };
    } catch (err) {
      const text = err instanceof HyperdRequestError
        ? `hyperD returned ${err.status}: ${err.message}`
        : `hyperD risk-full-audit call failed: ${err instanceof Error ? err.message : String(err)}`;
      await callback?.({ text, source: "hyperd" });
      return { success: false };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Give me a full risk audit on 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Running composed risk audit across 5 data sources...",
          action: "HYPERD_RISK_FULL_AUDIT",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Deep audit 0x1234567890123456789012345678901234567890 — is it safe?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Pulling full audit — balance, sanctions, persona, contracts, mixer exposure...",
          action: "HYPERD_RISK_FULL_AUDIT",
        },
      },
    ],
  ],
};

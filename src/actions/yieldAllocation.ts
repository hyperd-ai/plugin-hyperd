/**
 * Action: hyperd.yield.allocation (synthesis tier)
 *
 * Calls GET /api/synthesis/yield/allocation — fans out to three yield
 * recommendations (low / medium / high risk) simultaneously, then passes all
 * results through claude-haiku-4-5 to produce an optimal allocation plan for
 * the specified USDC amount.
 * Cost: $1.00 in USDC on Base.
 *
 * Activated when the user asks "where should I put $X", "best yield for 10k",
 * or similar yield/allocation questions with a dollar amount present.
 */

import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { HyperdClient, HyperdRequestError } from "../client.js";
import { resolveConfig } from "../config.js";
import type { VerdictEnvelope } from "../types.js";

const CHAIN_RE = /\b(base|ethereum|eth|mainnet|polygon|arbitrum|optimism|avalanche|bnb)\b/i;
// Matches numbers like: 10000, $10,000, 10k, $10k, 10.5k, 1.5m, $1.5m
const AMOUNT_RE = /\$?([\d,]+(?:\.\d+)?)\s*([km])?/i;

function extractAmount(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(AMOUNT_RE);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return null;
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") return base * 1_000;
  if (suffix === "m") return base * 1_000_000;
  return base;
}

function extractChain(text: string | undefined): string {
  if (!text) return "base";
  const m = text.match(CHAIN_RE);
  if (!m) return "base";
  const v = m[0].toLowerCase();
  if (v === "eth" || v === "mainnet") return "ethereum";
  return v;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

export const yieldAllocationAction: Action = {
  name: "HYPERD_YIELD_ALLOCATION",
  description:
    "Composed yield allocation plan ($1.00). Fans out to low/medium/high-risk yield recommendations simultaneously, then produces an LLM-optimised allocation split across DeFi protocols. Use when the user asks where to put a specific dollar amount to earn yield.",
  similes: [
    "YIELD_ALLOCATION",
    "BEST_YIELD_PLAN",
    "WHERE_TO_PUT_MONEY",
    "DEFI_YIELD_PLAN",
    "YIELD_OPTIMISE",
    "ALLOCATE_YIELD",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    return extractAmount(message?.content?.text) !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ) => {
    const text = message?.content?.text;
    const amount = extractAmount(text);
    const chain = extractChain(text);
    if (amount === null) {
      await callback?.({
        text: "I couldn't find a dollar amount in the message. Try: 'best yield for $10,000' or 'where to put 5k'.",
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
      const res = await client.get<VerdictEnvelope>("/api/synthesis/yield/allocation", { amount, chain });
      const v = res.verdict;
      const lines = [
        `Yield allocation plan for ${fmtUsd(amount)} on ${chain}:`,
        `• Strategy: ${v.band}`,
        `• ${v.summary}`,
        `• Confidence: ${(v.confidence * 100).toFixed(0)}%`,
        `• Coverage: ${res.coverage.sub_calls_succeeded}/${res.coverage.sub_calls_attempted} yield tiers sampled`,
      ];
      if (res.cache?.status === "hit") {
        lines.push("• (Cached result — yields are stable to 6h)");
      }
      if (res.coverage.sub_calls_failed.length > 0) {
        lines.push(`• Partial data — failed: ${res.coverage.sub_calls_failed.map((f) => f.id).join(", ")}`);
      }
      await callback?.({
        text: lines.join("\n"),
        source: "hyperd",
        action: "HYPERD_YIELD_ALLOCATION",
        content: res,
      });
      return { success: true };
    } catch (err) {
      const errText = err instanceof HyperdRequestError
        ? `hyperD returned ${err.status}: ${err.message}`
        : `hyperD yield-allocation call failed: ${err instanceof Error ? err.message : String(err)}`;
      await callback?.({ text: errText, source: "hyperd" });
      return { success: false };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Best yield strategy for $10,000 on base?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Sampling low/medium/high-risk yield tiers to build an allocation plan...",
          action: "HYPERD_YIELD_ALLOCATION",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Where should I put 50k USDC to earn yield?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Composing yield allocation plan for $50k across DeFi protocols...",
          action: "HYPERD_YIELD_ALLOCATION",
        },
      },
    ],
  ],
};

/**
 * Action: hyperd.token.archetype (synthesis tier)
 *
 * Calls GET /api/token/archetype — a composed endpoint that fans out
 * to token info, token security, and protocol TVL, then passes all results
 * through claude-haiku-4-5 to classify the token into an archetype (e.g.
 * "blue-chip", "DeFi utility", "meme", "rug risk", "governance token").
 * Cost: $0.30 in USDC on Base.
 *
 * Activated when the user asks what kind of token a contract is, wants a token
 * classification, or asks for a one-sentence take on a token's risk/utility.
 */

import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { HyperdClient, HyperdRequestError } from "../client.js";
import { resolveConfig } from "../config.js";
import type { VerdictEnvelope } from "../types.js";

const ADDR_RE = /0x[a-fA-F0-9]{40}/;
const CHAIN_RE = /\b(base|ethereum|eth|mainnet|polygon|arbitrum|optimism|avalanche|bnb)\b/i;

function extractAddress(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.match(ADDR_RE);
  return m ? m[0] : null;
}

function extractChain(text: string | undefined): string {
  if (!text) return "base";
  const m = text.match(CHAIN_RE);
  if (!m) return "base";
  const v = m[0].toLowerCase();
  if (v === "eth" || v === "mainnet") return "ethereum";
  return v;
}

export const tokenArchetypeAction: Action = {
  name: "HYPERD_TOKEN_ARCHETYPE",
  description:
    "Classify a token contract into an archetype ($0.30). Fans out to token info + security + TVL, then produces an LLM verdict categorising it (e.g. blue-chip, DeFi utility, meme, governance, rug risk). Use when the user wants to understand what a token is and whether it's worth holding.",
  similes: [
    "TOKEN_CLASSIFY",
    "TOKEN_ARCHETYPE_CHECK",
    "WHAT_IS_THIS_TOKEN",
    "TOKEN_CATEGORY",
    "TOKEN_TYPE_CHECK",
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
    const text = message?.content?.text;
    const contract = extractAddress(text);
    const chain = extractChain(text);
    if (!contract) {
      await callback?.({
        text: "I couldn't find a token contract address (0x...) in the message to classify.",
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
      const res = await client.get<VerdictEnvelope>("/api/token/archetype", { contract, chain });
      const v = res.verdict;
      const lines = [
        `Token archetype for ${contract} on ${chain}:`,
        `• Archetype: ${v.band}`,
        `• ${v.summary}`,
        `• Confidence: ${(v.confidence * 100).toFixed(0)}%`,
        `• Coverage: ${res.coverage.sub_calls_succeeded}/${res.coverage.sub_calls_attempted} sub-calls`,
      ];
      if (res.coverage.sub_calls_failed.length > 0) {
        lines.push(`• Partial data — failed: ${res.coverage.sub_calls_failed.map((f) => f.id).join(", ")}`);
      }
      await callback?.({
        text: lines.join("\n"),
        source: "hyperd",
        action: "HYPERD_TOKEN_ARCHETYPE",
        content: res,
      });
      return { success: true };
    } catch (err) {
      const text = err instanceof HyperdRequestError
        ? `hyperD returned ${err.status}: ${err.message}`
        : `hyperD token-archetype call failed: ${err instanceof Error ? err.message : String(err)}`;
      await callback?.({ text, source: "hyperd" });
      return { success: false };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What kind of token is 0x4200000000000000000000000000000000000006 on base?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Classifying token archetype — pulling info, security score, and TVL...",
          action: "HYPERD_TOKEN_ARCHETYPE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Is 0x1234567890123456789012345678901234567890 a blue-chip or a meme?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Running token archetype classification...",
          action: "HYPERD_TOKEN_ARCHETYPE",
        },
      },
    ],
  ],
};

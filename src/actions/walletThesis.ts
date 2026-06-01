/**
 * Action: hyperd.wallet.thesis (synthesis tier)
 *
 * Calls GET /api/wallet/thesis — a composed endpoint that fans out
 * to balance, wallet persona, wallet P&L, and wallet anomaly, then passes
 * all results through claude-haiku-4-5 to produce a one-paragraph investment
 * thesis or behavioural summary of the wallet.
 * Cost: $0.50 in USDC on Base.
 *
 * Activated when the user asks "what kind of trader is this?", "summarise
 * this wallet's strategy", or "write a thesis on this address".
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

export const walletThesisAction: Action = {
  name: "HYPERD_WALLET_THESIS",
  description:
    "Composed wallet investment thesis ($0.50). Fans out to balance + persona + P&L + anomaly detection, then produces an LLM verdict summarising the wallet's DeFi strategy, trader type, and risk appetite. Use when the user wants to understand what kind of participant a wallet is.",
  similes: [
    "WALLET_THESIS",
    "WALLET_STRATEGY_SUMMARY",
    "WALLET_PROFILE",
    "TRADER_THESIS",
    "WALLET_BEHAVIOUR_SUMMARY",
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
    const address = extractAddress(text);
    const chain = extractChain(text);
    if (!address) {
      await callback?.({
        text: "I couldn't find an EVM address (0x...) in the message to build a thesis for.",
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
      const res = await client.get<VerdictEnvelope>("/api/wallet/thesis", { address, chain });
      const v = res.verdict;
      const lines = [
        `Wallet thesis for ${address} on ${chain}:`,
        `• Type: ${v.band}`,
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
        action: "HYPERD_WALLET_THESIS",
        content: res,
      });
      return { success: true };
    } catch (err) {
      const errText = err instanceof HyperdRequestError
        ? `hyperD returned ${err.status}: ${err.message}`
        : `hyperD wallet-thesis call failed: ${err instanceof Error ? err.message : String(err)}`;
      await callback?.({ text: errText, source: "hyperd" });
      return { success: false };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What kind of trader is 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Building wallet thesis — pulling balance, persona, P&L, and anomalies...",
          action: "HYPERD_WALLET_THESIS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Summarise the strategy for wallet 0x1234567890123456789012345678901234567890" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Composing wallet strategy thesis...",
          action: "HYPERD_WALLET_THESIS",
        },
      },
    ],
  ],
};

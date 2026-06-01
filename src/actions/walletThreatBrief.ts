/**
 * Action: hyperd.wallet.threat_brief (synthesis tier)
 *
 * Calls GET /api/wallet/threat_brief — a composed endpoint that fans
 * out to wallet risk, wallet anomaly, privacy/mixer risk, budget guardian, and
 * wallet persona, then passes all results through claude-haiku-4-5 to produce
 * an intelligence-style threat brief.
 * Cost: $1.50 in USDC on Base.
 *
 * Activated when the user asks for a threat report, compliance brief, or
 * "what's the worst case scenario" for an address.
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

export const walletThreatBriefAction: Action = {
  name: "HYPERD_WALLET_THREAT_BRIEF",
  description:
    "Composed wallet threat intelligence brief ($1.50). Fans out to wallet risk + anomaly + mixer exposure + budget guardian + persona, then produces a compliance-grade threat brief with risk band and actionable findings. Use when the user needs a full adversarial picture of a wallet.",
  similes: [
    "WALLET_THREAT_REPORT",
    "COMPLIANCE_BRIEF",
    "WALLET_INTELLIGENCE_BRIEF",
    "THREAT_BRIEF",
    "ADVERSARIAL_WALLET_CHECK",
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
        text: "I couldn't find an EVM address (0x...) in the message to generate a threat brief for.",
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
      const res = await client.get<VerdictEnvelope>("/api/wallet/threat_brief", { address, chain });
      const v = res.verdict;
      const lines = [
        `Threat brief for ${address} on ${chain}:`,
        `• Risk band: ${v.band}`,
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
        action: "HYPERD_WALLET_THREAT_BRIEF",
        content: res,
      });
      return { success: true };
    } catch (err) {
      const errText = err instanceof HyperdRequestError
        ? `hyperD returned ${err.status}: ${err.message}`
        : `hyperD wallet-threat-brief call failed: ${err instanceof Error ? err.message : String(err)}`;
      await callback?.({ text: errText, source: "hyperd" });
      return { success: false };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Generate a threat brief for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Compiling threat brief — risk, anomalies, mixer exposure, budget...",
          action: "HYPERD_WALLET_THREAT_BRIEF",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Compliance check on 0x1234567890123456789012345678901234567890 — full threat report" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Running 5-source wallet threat brief...",
          action: "HYPERD_WALLET_THREAT_BRIEF",
        },
      },
    ],
  ],
};

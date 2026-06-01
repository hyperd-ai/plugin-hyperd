/**
 * Action: hyperd.gov.translate (synthesis tier)
 *
 * Calls GET /api/synthesis/gov/translate — fetches a governance proposal from
 * Snapshot or Tally via the governance.summarize endpoint, then passes the
 * result through claude-haiku-4-5 to produce a plain-English voter guide:
 * what the proposal does, who benefits, and a recommended vote stance.
 * Cost: $1.00 in USDC on Base.
 *
 * Activated when the user pastes a Snapshot or Tally URL and asks what the
 * proposal means, how to vote, or wants a plain-English summary.
 */

import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { HyperdClient, HyperdRequestError } from "../client.js";
import { resolveConfig } from "../config.js";
import type { VerdictEnvelope } from "../types.js";

const PROPOSAL_URL_RE = /https?:\/\/(?:snapshot\.org|tally\.xyz|www\.tally\.xyz)[^\s]*/i;

function extractProposalUrl(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.match(PROPOSAL_URL_RE);
  return m ? m[0] : null;
}

export const govTranslateAction: Action = {
  name: "HYPERD_GOV_TRANSLATE",
  description:
    "Plain-English governance proposal translation ($1.00). Takes a Snapshot or Tally proposal URL, fetches the full text via hyperD's governance endpoint, and returns an LLM verdict with a voter guide: what it does, who benefits, and a recommended stance. Use when the user pastes a proposal link and wants to understand how to vote.",
  similes: [
    "GOV_TRANSLATE",
    "GOVERNANCE_TRANSLATE",
    "PROPOSAL_SUMMARY",
    "VOTER_GUIDE",
    "GOVERNANCE_VOTER_GUIDE",
    "EXPLAIN_PROPOSAL",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    return extractProposalUrl(message?.content?.text) !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ) => {
    const proposal_url = extractProposalUrl(message?.content?.text);
    if (!proposal_url) {
      await callback?.({
        text: "I couldn't find a Snapshot or Tally proposal URL in the message. Paste the full URL (e.g. https://snapshot.org/#/...).",
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
      const res = await client.get<VerdictEnvelope>("/api/synthesis/gov/translate", { proposal_url });
      const v = res.verdict;
      const lines = [
        `Governance voter guide:`,
        `• Stance: ${v.band}`,
        `• ${v.summary}`,
        `• Confidence: ${(v.confidence * 100).toFixed(0)}%`,
      ];
      if (res.cache?.status === "hit") {
        lines.push("• (Cached result — proposal text is immutable)");
      }
      await callback?.({
        text: lines.join("\n"),
        source: "hyperd",
        action: "HYPERD_GOV_TRANSLATE",
        content: res,
      });
      return { success: true };
    } catch (err) {
      const errText = err instanceof HyperdRequestError
        ? `hyperD returned ${err.status}: ${err.message}`
        : `hyperD gov-translate call failed: ${err instanceof Error ? err.message : String(err)}`;
      await callback?.({ text: errText, source: "hyperd" });
      return { success: false };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What does this proposal mean and should I vote yes? https://snapshot.org/#/uniswap/proposal/0x1234" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Translating governance proposal into plain English...",
          action: "HYPERD_GOV_TRANSLATE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Voter guide for https://www.tally.xyz/gov/compound/proposal/142" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Fetching and translating proposal — this may take a moment...",
          action: "HYPERD_GOV_TRANSLATE",
        },
      },
    ],
  ],
};

/**
 * @hyperd-ai/plugin-hyperd — ElizaOS plugin for hyperD
 *
 * Exposes 11 hyperD endpoints as agent actions.
 *
 * Base tier (5 actions):
 *   • HYPERD_WALLET_RISK       — Chainalysis Sanctions + GoPlus heuristics ($0.10)
 *   • HYPERD_TOKEN_SECURITY    — GoPlus token risk score ($0.05)
 *   • HYPERD_LIQUIDATION_RISK  — Cross-protocol health factor ($0.10)
 *   • HYPERD_WALLET_PNL        — Realized + unrealized P&L ($0.05)
 *   • HYPERD_DEX_QUOTE         — Best swap route aggregator ($0.02)
 *
 * Synthesis tier (6 actions) — multi-source fan-out + LLM verdict:
 *   • HYPERD_RISK_FULL_AUDIT   — 5-source composed risk audit ($0.35)
 *   • HYPERD_TOKEN_ARCHETYPE   — Token classification via info+security+TVL ($0.30)
 *   • HYPERD_WALLET_THESIS     — Investment thesis via balance+persona+P&L+anomaly ($0.50)
 *   • HYPERD_WALLET_THREAT_BRIEF — Compliance threat brief, 5 sources ($1.50)
 *   • HYPERD_GOV_TRANSLATE     — Governance proposal voter guide ($1.00)
 *   • HYPERD_YIELD_ALLOCATION  — Optimal yield allocation plan ($1.00)
 *
 * Requires env / agentConfig:
 *   HYPERD_BUYER_PRIVATE_KEY  (required) — 0x-prefixed EVM private key
 *   HYPERD_API_BASE           (optional, default https://api.hyperd.ai)
 *   HYPERD_MAX_USDC_PER_CALL  (optional, default 0.25)
 *
 * Note: synthesis-tier actions cost up to $1.50/call. If your
 * HYPERD_MAX_USDC_PER_CALL cap is below $1.50, raise it or the plugin will
 * refuse those calls. Recommended cap for synthesis tier: $2.00.
 *
 * The wallet at HYPERD_BUYER_PRIVATE_KEY must hold USDC on Base. The plugin
 * signs EIP-3009 transfer authorizations per call; settlement happens via
 * Coinbase's x402 facilitator in roughly two seconds.
 */

import type { Plugin } from "@elizaos/core";
import { walletRiskAction } from "./actions/walletRisk.js";
import { tokenSecurityAction } from "./actions/tokenSecurity.js";
import { liquidationRiskAction } from "./actions/liquidationRisk.js";
import { walletPnlAction } from "./actions/walletPnl.js";
import { dexQuoteAction } from "./actions/dexQuote.js";
import { riskFullAuditAction } from "./actions/riskFullAudit.js";
import { tokenArchetypeAction } from "./actions/tokenArchetype.js";
import { walletThesisAction } from "./actions/walletThesis.js";
import { walletThreatBriefAction } from "./actions/walletThreatBrief.js";
import { govTranslateAction } from "./actions/govTranslate.js";
import { yieldAllocationAction } from "./actions/yieldAllocation.js";

export const hyperdPlugin: Plugin = {
  name: "hyperd",
  description:
    "On-demand DeFi intelligence for elizaOS agents — wallet risk, token security, liquidation alerts, P&L, DEX quotes, and 6 synthesis-tier composed verdicts. Paid per-call in USDC on Base via x402. No API key, no signup.",
  actions: [
    // Base tier
    walletRiskAction,
    tokenSecurityAction,
    liquidationRiskAction,
    walletPnlAction,
    dexQuoteAction,
    // Synthesis tier
    riskFullAuditAction,
    tokenArchetypeAction,
    walletThesisAction,
    walletThreatBriefAction,
    govTranslateAction,
    yieldAllocationAction,
  ],
};

export default hyperdPlugin;

// Named re-exports — useful for typed consumers and tests.
export {
  walletRiskAction,
  tokenSecurityAction,
  liquidationRiskAction,
  walletPnlAction,
  dexQuoteAction,
  riskFullAuditAction,
  tokenArchetypeAction,
  walletThesisAction,
  walletThreatBriefAction,
  govTranslateAction,
  yieldAllocationAction,
};
export { HyperdClient, HyperdRequestError } from "./client.js";
export { resolveConfig } from "./config.js";
export type { HyperdConfig } from "./config.js";
export type {
  WalletRiskResponse,
  TokenSecurityResponse,
  LiquidationRiskResponse,
  WalletPnlResponse,
  DexQuoteResponse,
  HyperdAnyResponse,
  VerdictBlock,
  VerdictEnvelope,
} from "./types.js";

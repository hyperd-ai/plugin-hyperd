# @hyperd-ai/plugin-hyperd

> ElizaOS plugin for [hyperD](https://hyperd.ai) — on-demand DeFi intelligence (wallet risk, token security, liquidation alerts, P&L, DEX quotes, and synthesis-tier composed verdicts) paid per-call in USDC on Base via the x402 protocol. **No API key. No signup.**

[![npm](https://img.shields.io/npm/v/@hyperd-ai/plugin-hyperd.svg)](https://www.npmjs.com/package/@hyperd-ai/plugin-hyperd)
[![license](https://img.shields.io/npm/l/@hyperd-ai/plugin-hyperd.svg)](./LICENSE)

Sibling package to [`hyperd-mcp`](https://www.npmjs.com/package/hyperd-mcp). Will be republished as `@elizaos/plugin-hyperd` once landed in the first-party elizaOS monorepo.

## What this plugin gives your agent

### Base tier

| Action | Description | Cost |
|---|---|---|
| `HYPERD_WALLET_RISK` | Chainalysis Sanctions Oracle + GoPlus heuristics. "Is this address safe to interact with." | $0.10 |
| `HYPERD_TOKEN_SECURITY` | GoPlus security score 0–100. Honeypot detection, owner permissions, taxes, holder concentration. | $0.05 |
| `HYPERD_LIQUIDATION_RISK` | Cross-protocol composite health factor across Aave V3 / Compound v3 / Spark / Morpho. | $0.10 |
| `HYPERD_WALLET_PNL` | Realized + unrealized P&L over a configurable window. Per-token breakdown with mark-to-market. | $0.05 |
| `HYPERD_DEX_QUOTE` | Best swap route aggregated across Paraswap + 0x. Highest output + per-source breakdown. | $0.02 |

**Total to call all five once: $0.32.** Every agent decision cycle costs less than a third of a cent.

### Synthesis tier

Synthesis actions fan out to multiple data sources simultaneously, then pass all results through claude-haiku-4-5 to produce a single structured verdict with a confidence score and a risk/strategy band. They are more expensive than base-tier calls, but replace 3–5 separate calls plus custom aggregation logic in your agent.

> **Note:** The default `HYPERD_MAX_USDC_PER_CALL` cap ($0.25) is below some synthesis-tier prices. Raise it to `$2.00` in your agent config to enable all synthesis actions.

| Action | Description | Cost |
|---|---|---|
| `HYPERD_RISK_FULL_AUDIT` | Composed audit: balance + sanctions + persona + contract + mixer exposure → single verdict with risk band (safe / moderate / elevated / critical). | $0.35 |
| `HYPERD_TOKEN_ARCHETYPE` | Token classification: info + security + TVL → archetype label (blue-chip, DeFi utility, meme, governance, rug risk, etc.). | $0.30 |
| `HYPERD_WALLET_THESIS` | Investment thesis: balance + persona + P&L + anomaly → one-paragraph strategy/behaviour summary. | $0.50 |
| `HYPERD_WALLET_THREAT_BRIEF` | Compliance threat brief: risk + anomaly + mixer + budget guardian + persona → intelligence-grade report. | $1.50 |
| `HYPERD_GOV_TRANSLATE` | Governance voter guide: fetches a Snapshot or Tally proposal → plain-English summary + recommended stance. | $1.00 |
| `HYPERD_YIELD_ALLOCATION` | Yield allocation plan: samples low/medium/high-risk yield tiers → optimal allocation split for a given USDC amount. | $1.00 |

The plugin handles the x402 payment flow transparently. Your agent signs EIP-3009 USDC transfer authorizations on Base; Coinbase's facilitator settles in ~2 seconds. There is no key store to rotate, no rate-limit form to fill, no signup. The signed payment is the auth.

## Installation

```bash
npm install @hyperd-ai/plugin-hyperd
# or
bun add @hyperd-ai/plugin-hyperd
```

## Configuration

Set these in your agent's environment (or via the elizaOS dashboard for hosted agents):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `HYPERD_BUYER_PRIVATE_KEY` | **Yes** | — | 0x-prefixed 32-byte hex EVM private key. The wallet must hold USDC on Base. |
| `HYPERD_API_BASE` | No | `https://api.hyperd.ai` | Override only for self-hosted or testing. |
| `HYPERD_MAX_USDC_PER_CALL` | No | `0.25` | Refuses calls priced above this cap. Raise to `2.00` to enable synthesis-tier actions (up to $1.50/call). |

**Funding:** ~$5 of USDC on Base is plenty for hundreds of base-tier agent decision cycles, or a smaller number of synthesis-tier calls. Bridge from Ethereum or buy directly on Base via Coinbase / Coinbase Wallet.

## Usage

```ts
import { createAgent } from "@elizaos/core";
import { hyperdPlugin } from "@hyperd-ai/plugin-hyperd";

const agent = await createAgent({
  name: "DeFi-Aware Agent",
  plugins: [hyperdPlugin, /* ...your other plugins */],
});
```

That's it. All 11 actions become available; the LLM picks the right one based on what the user asks.

### What the agent can now do

| User prompt | Action invoked | Cost |
|---|---|---|
| "Is `0xd8dA…6045` safe to send to?" | `HYPERD_WALLET_RISK` | $0.10 |
| "Is `0x4200…0006` a scam token on Base?" | `HYPERD_TOKEN_SECURITY` | $0.05 |
| "Am I about to get liquidated? `0xd8dA…6045`" | `HYPERD_LIQUIDATION_RISK` | $0.10 |
| "What's my P&L? `0xd8dA…6045`" | `HYPERD_WALLET_PNL` | $0.05 |
| "Best price for 100 USDC to WETH?" | `HYPERD_DEX_QUOTE` | $0.02 |
| "Full risk audit on `0xd8dA…6045`" | `HYPERD_RISK_FULL_AUDIT` | $0.35 |
| "What kind of token is `0x4200…0006`?" | `HYPERD_TOKEN_ARCHETYPE` | $0.30 |
| "What kind of trader is `0xd8dA…6045`?" | `HYPERD_WALLET_THESIS` | $0.50 |
| "Threat brief on `0xd8dA…6045`" | `HYPERD_WALLET_THREAT_BRIEF` | $1.50 |
| "Translate this Snapshot vote: https://snapshot.org/#/…" | `HYPERD_GOV_TRANSLATE` | $1.00 |
| "Best yield strategy for $10,000 on Base?" | `HYPERD_YIELD_ALLOCATION` | $1.00 |

## How the x402 payment works (one paragraph)

The plugin wraps `globalThis.fetch` with [`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch). Each request that returns 402 Payment Required carries machine-readable payment terms in the response header. The plugin signs an EIP-3009 USDC transfer authorization on Base (with the configured private key), retries the request with an `X-Payment` header, and Coinbase's x402 facilitator settles the transfer in ~2 seconds. The retry returns the actual data. No human, no key rotation, no monthly minimum.

## What hyperD is

hyperD is a pay-per-call DeFi API service for AI agents. Production at [`api.hyperd.ai`](https://api.hyperd.ai). Endpoints cover wallet risk, token security, liquidation health, portfolio P&L, DEX routing, governance summaries, sentiment, gas markets, multi-protocol TVL, a bundle endpoint (up to 10 calls, single $0.20 settlement), and the synthesis tier (multi-source fan-out + LLM verdict). MIT-licensed mirror at [`github.com/hyperd-ai/hyperd-mcp`](https://github.com/hyperd-ai/hyperd-mcp). MCP server live on [Smithery](https://smithery.ai/servers/hyperd/hyperd-mcp) and indexed in [CDP Bazaar](https://api.hyperd.ai/api/discover).

## Roadmap

- **v0.1**: 5 marquee base-tier actions.
- **v0.2** (this release): 6 synthesis-tier composed verdict actions.
- **v0.3**: Add provider (auto-injects wallet balance + cost-of-call into agent context) + service (cached client + spend tracker).
- **v1.0**: First-party PR to [`elizaOS/eliza`](https://github.com/elizaOS/eliza), republished as `@elizaos/plugin-hyperd`.

## Links

- **API**: [api.hyperd.ai](https://api.hyperd.ai)
- **Discover**: [api.hyperd.ai/api/discover](https://api.hyperd.ai/api/discover)
- **MCP server**: [npm](https://www.npmjs.com/package/hyperd-mcp), [Smithery](https://smithery.ai/servers/hyperd/hyperd-mcp)
- **Source mirror**: [github.com/hyperd-ai/hyperd-mcp](https://github.com/hyperd-ai/hyperd-mcp)
- **x402 protocol**: [x402.org](https://x402.org)

## License

MIT. Built for agents that pay their own way.

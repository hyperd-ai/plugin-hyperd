# @hyperd-ai/plugin-hyperd

> ElizaOS plugin for [hyperD](https://hyperd.ai) — on-demand DeFi intelligence (wallet risk, token security, liquidation alerts, P&L, DEX quotes) paid per-call in USDC on Base via the x402 protocol. **No API key. No signup.**

[![npm](https://img.shields.io/npm/v/@hyperd-ai/plugin-hyperd.svg)](https://www.npmjs.com/package/@hyperd-ai/plugin-hyperd)
[![license](https://img.shields.io/npm/l/@hyperd-ai/plugin-hyperd.svg)](./LICENSE)

Sibling package to [`hyperd-mcp`](https://www.npmjs.com/package/hyperd-mcp). Will be republished as `@elizaos/plugin-hyperd` once landed in the first-party elizaOS monorepo.

## What this plugin gives your agent

| Action | Description | Cost |
|---|---|---|
| `HYPERD_WALLET_RISK` | Chainalysis Sanctions Oracle + GoPlus heuristics. "Is this address safe to interact with." | $0.10 |
| `HYPERD_TOKEN_SECURITY` | GoPlus security score 0–100. Honeypot detection, owner permissions, taxes, holder concentration. | $0.05 |
| `HYPERD_LIQUIDATION_RISK` | Cross-protocol composite health factor across Aave V3 / Compound v3 / Spark / Morpho. | $0.10 |
| `HYPERD_WALLET_PNL` | Realized + unrealized P&L over a configurable window. Per-token breakdown with mark-to-market. | $0.05 |
| `HYPERD_DEX_QUOTE` | Best swap route aggregated across Paraswap + 0x. Highest output + per-source breakdown. | $0.02 |

**Total to call all five once: $0.32.** Every agent decision cycle costs less than a third of a cent.

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
| `HYPERD_MAX_USDC_PER_CALL` | No | `0.25` | Refuses calls priced above this cap. |

**Funding:** ~$5 of USDC on Base is plenty for hundreds of agent decision cycles. Bridge from Ethereum or buy directly on Base via Coinbase / Coinbase Wallet.

## Usage

```ts
import { createAgent } from "@elizaos/core";
import { hyperdPlugin } from "@hyperd-ai/plugin-hyperd";

const agent = await createAgent({
  name: "DeFi-Aware Agent",
  plugins: [hyperdPlugin, /* ...your other plugins */],
});
```

That's it. The five actions become available; the LLM picks the right one based on what the user asks.

### What the agent can now do

| User prompt | Action invoked | Cost |
|---|---|---|
| "Is `0xd8dA…6045` safe to send to?" | `HYPERD_WALLET_RISK` | $0.10 |
| "Is `0x4200…0006` a scam token on Base?" | `HYPERD_TOKEN_SECURITY` | $0.05 |
| "Am I about to get liquidated? `0xd8dA…6045`" | `HYPERD_LIQUIDATION_RISK` | $0.10 |
| "What's my P&L? `0xd8dA…6045`" | `HYPERD_WALLET_PNL` | $0.05 |
| "Best price for 100 USDC to WETH?" | `HYPERD_DEX_QUOTE` | $0.02 |

## How the x402 payment works (one paragraph)

The plugin wraps `globalThis.fetch` with [`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch). Each request that returns 402 Payment Required carries machine-readable payment terms in the response header. The plugin signs an EIP-3009 USDC transfer authorization on Base (with the configured private key), retries the request with an `X-Payment` header, and Coinbase's x402 facilitator settles the transfer in ~2 seconds. The retry returns the actual data. No human, no key rotation, no monthly minimum.

## What hyperD is

hyperD is a pay-per-call DeFi API service for AI agents. Twenty paid endpoints covering wallet risk, token security, liquidation health, portfolio P&L, DEX routing, governance summaries, sentiment, gas markets, multi-protocol TVL, and a bundle endpoint that combines up to 10 calls into a single $0.20 settlement. Production at [`api.hyperd.ai`](https://api.hyperd.ai). MIT-licensed mirror at [`github.com/hyperd-ai/hyperd-mcp`](https://github.com/hyperd-ai/hyperd-mcp). MCP server live on [Smithery](https://smithery.ai/servers/hyperd/hyperd-mcp) and indexed in [CDP Bazaar](https://api.hyperd.ai/api/discover).

This plugin exposes the 5 highest-value endpoints for an agent's decision loop. The other 15 (balance, yield, token info, governance summary, sentiment, gas estimate, persona, audit, anomaly, budget guardian, TVL, bundle, watch subscriptions, etc.) are available via plain HTTP or the MCP server, and will land in subsequent plugin versions.

## Roadmap

- **v0.1** (this release): 5 marquee actions.
- **v0.2**: Add `HYPERD_GOVERNANCE_SUMMARIZE`, `HYPERD_GAS_ESTIMATE`, `HYPERD_TOKEN_SENTIMENT`, `HYPERD_PROTOCOL_TVL`, `HYPERD_BUNDLE`.
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

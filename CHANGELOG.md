# Changelog

## 0.1.1 — 2026-05-12

### Security

- **Enforce `HYPERD_MAX_USDC_PER_CALL` cap** in the x402 buyer flow. Previous versions stored the cap as a field on `HyperdClient` but never consulted it — `wrapFetchWithPaymentFromConfig` signed whatever amount the server requested in its 402 challenge. A misbehaving or compromised server could have drained the buyer wallet in a single call. Now wired through `paymentRequirementsSelector`: requirements above the cap are filtered out, and if none qualify the wrap throws so the call fails fast rather than overpaying.

  Identified by greptile-apps on [elizaOS/eliza#7622](https://github.com/elizaOS/eliza/pull/7622) review.

## 0.1.0 — 2026-05-11

Initial release. Five marquee actions: `HYPERD_WALLET_RISK`, `HYPERD_TOKEN_SECURITY`, `HYPERD_LIQUIDATION_RISK`, `HYPERD_WALLET_PNL`, `HYPERD_DEX_QUOTE`.

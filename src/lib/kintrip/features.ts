/**
 * Deployment switches for optional features (CE07). Set in the environment;
 * switching a feature off hides new entry points and refuses new changes, but
 * keeps plans and records already created readable.
 *
 *   VITE_FEATURE_ARRANGEMENTS=off  — hide temporary trip arrangements (CE05)
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const ARRANGEMENTS_ENABLED = env["VITE_FEATURE_ARRANGEMENTS"] !== "off";

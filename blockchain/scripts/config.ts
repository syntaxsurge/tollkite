/**
 * Deployment configuration
 *
 * In CI and production you **must** supply all three addresses via the
 * environment. Local scripts leave optional role addresses unset when the
 * corresponding variables are missing.
 *
 * ── ENV VARS ────────────────────────────────────────────────────────────────
 *   ADMIN_ADDRESS       → receives DEFAULT_ADMIN_ROLE and ADMIN_ROLE
 *   ISSUER_ADDRESSES    → comma-separated list that will be granted ISSUER_ROLE
 *   PLATFORM_ADDRESS    → account that obtains PLATFORM_ROLE
 * ────────────────────────────────────────────────────────────────────────────
 */

import { getAddress } from "ethers";

/* -------------------------------------------------------------------------- */
/*                               H E L P E R S                                */
/* -------------------------------------------------------------------------- */

/** EIP-55-checksum an address and trim stray whitespace. */
function normalise(addr: string): string {
  return getAddress(addr.trim());
}

/** Unique filter helper. */
const uniq = <T>(arr: T[]) => Array.from(new Set(arr));

/* -------------------------------------------------------------------------- */
/*                              E N V   L O A D                               */
/* -------------------------------------------------------------------------- */

const env = process.env as Record<string, string | undefined>;

/* -------------------------------------------------------------------------- */
/*                             C O R E  R O L E S                             */
/* -------------------------------------------------------------------------- */

export const adminAddress = env.ADMIN_ADDRESS ? normalise(env.ADMIN_ADDRESS) : "";

export const platformAddress = env.PLATFORM_ADDRESS ? normalise(env.PLATFORM_ADDRESS) : "";

/* -------------------------------------------------------------------------- */
/*                         I S S U E R   A D D R E S S E S                    */
/* -------------------------------------------------------------------------- */

/**
 * Parse ISSUER_ADDRESSES into a unique, checksummed array while skipping empty
 * strings and never re-adding admin / platform addresses.
 */
export const issuerAddresses: string[] = uniq(
  (env.ISSUER_ADDRESSES ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(normalise)
).filter(a => a !== adminAddress && a !== platformAddress);

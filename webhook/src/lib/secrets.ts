'use strict'

import { readFileSync } from 'fs'

/**
 * Read a secret from a file-backed env var first, then fall back to the plain
 * environment variable.
 *
 * This mirrors the pattern the official Postgres image already uses for
 * POSTGRES_PASSWORD / POSTGRES_PASSWORD_FILE and extends it to the other
 * secrets the webhook reads (FIREBASE_PRIVATE_KEY, TRUSTLESSWORK_API_KEY,
 * TRUSTLESSWORK_WEBHOOK_SECRET, HASURA_GRAPHQL_ADMIN_SECRET).
 *
 * When both the *_FILE variant and the plain variable are set, the file wins.
 * When neither is set, `undefined` is returned so callers can decide how to
 * handle the missing value (hard-fail in production, skip in test, etc.).
 */
export function readSecretFileOrEnv(fileVar: string, plainVar: string): string | undefined {
  const filePath = process.env[fileVar]
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf8').replace(/\r?\n$/, '')
    } catch (err) {
      throw new Error(
        `Failed to read ${fileVar}="${filePath}": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  return process.env[plainVar]
}

/**
 * Like readSecretFileOrEnv, but throws in production when the secret is missing.
 */
export function requireSecret(fileVar: string, plainVar: string, label: string): string {
  const value = readSecretFileOrEnv(fileVar, plainVar)
  if (!value) {
    const msg = `Missing ${label} — set ${plainVar} or ${fileVar}`
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    }
    console.warn(`[secrets] ${msg} — skipping (non-production)`)
    return ''
  }
  return value
}

/**
 * Read the TrustlessWork API key from TRUSTLESSWORK_API_KEY_FILE or
 * TRUSTLESSWORK_API_KEY. This is the single place to read that secret so the
 * *_FILE variant is honored whenever a consumer is wired up.
 *
 * Nothing in the current codebase consumes this yet — it is exported so a future
 * HTTP client can use it without reintroducing a plain-process.env read.
 */
export function getTrustlessworkApiKey(): string | undefined {
  return readSecretFileOrEnv('TRUSTLESSWORK_API_KEY_FILE', 'TRUSTLESSWORK_API_KEY')
}

/**
 * Read the Hasura admin secret from HASURA_GRAPHQL_ADMIN_SECRET_FILE or
 * HASURA_GRAPHQL_ADMIN_SECRET. Administrative calls that the webhook makes to its
 * own Hasura instance should use this rather than a raw process.env read.
 */
export function getHasuraAdminSecret(): string | undefined {
  return readSecretFileOrEnv(
    'HASURA_GRAPHQL_ADMIN_SECRET_FILE',
    'HASURA_GRAPHQL_ADMIN_SECRET',
  )
}

'use strict'

import { Pool, QueryResult, PoolClient, QueryResultRow } from 'pg'
import { requireSecret } from '../lib/secrets'

// Fail fast — never use hardcoded credentials in production
const requiredEnvVars = ['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER']
for (const key of requiredEnvVars) {
  if (!process.env[key] && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

// The webhook supports both POSTGRES_PASSWORD and POSTGRES_PASSWORD_FILE (file-backed
// secret). The file wins when both are set, matching the official Postgres image pattern.
export const pool = new Pool({
  host:     process.env.POSTGRES_HOST     ?? 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  database: process.env.POSTGRES_DB       ?? 'postgres',
  user:     process.env.POSTGRES_USER     ?? 'postgres',
  password: requireSecret('POSTGRES_PASSWORD_FILE', 'POSTGRES_PASSWORD', 'POSTGRES_PASSWORD'),
})

pool.on('error', (err: Error) => {
  console.error('[db] Unexpected error on idle database client:', err)
})

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params)
}

export async function connect(): Promise<PoolClient> {
  return pool.connect()
}

export default { query, connect, pool }
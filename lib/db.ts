import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector'
import { Pool, PoolClient, types } from 'pg'
import { writeFileSync, unlinkSync } from 'fs'

// Parse NUMERIC/DECIMAL as float (default is string)
types.setTypeParser(1700, (val) => parseFloat(val))
// Parse INT8/BIGINT as int (default is string)
types.setTypeParser(20, (val) => parseInt(val, 10))

const g = globalThis as { _pgPool?: Promise<Pool>; _pgConnector?: Connector }

// Transient error codes that warrant a single retry
const TRANSIENT_ERRORS = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'CONNECTION_TERMINATED_UNEXPECTEDLY',
])
const TRANSIENT_PG_CODES = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
])

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const code = (err as { code?: string }).code
  if (code && TRANSIENT_ERRORS.has(code)) return true
  if (code && TRANSIENT_PG_CODES.has(code)) return true
  if (err.message?.includes('Connection terminated unexpectedly')) return true
  return false
}

async function initPool(): Promise<Pool> {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!, 'base64').toString()
  )
  const tmpPath = `/tmp/gcp-bwts-${Date.now()}.json`
  writeFileSync(tmpPath, JSON.stringify(credentials), { mode: 0o600 })
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath

  const connector = new Connector()
  g._pgConnector = connector

  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME!,
    ipType: IpAddressTypes.PUBLIC,
  })

  try { unlinkSync(tmpPath) } catch { }

  const pool = new Pool({
    ...clientOpts,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    max: 5,                          // was 10 → 5 apps × 5 = 25, fits any tier
    min: 1,                          // keep 1 warm connection, avoid cold-start latency
    idleTimeoutMillis: 30_000,       // release idle connections after 30s
    connectionTimeoutMillis: 10_000, // fail fast after 10s if pool exhausted
  })

  // 30s statement timeout on every new connection
  pool.on('connect', (client: PoolClient) => {
    client.query('SET statement_timeout = 30000').catch(() => {})
  })

  // Log idle client errors instead of crashing
  pool.on('error', (err: Error) => {
    console.error('[db] Idle client error (non-fatal):', err.message)
  })

  return pool
}

// Graceful shutdown
function registerShutdownHooks() {
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[db] ${signal} received, draining pool...`)
    try {
      const pool = g._pgPool ? await g._pgPool : null
      if (pool) await pool.end()
      g._pgConnector?.close()
    } catch (err) {
      console.error('[db] Shutdown error:', err)
    }
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}
registerShutdownHooks()

export function getPool(): Promise<Pool> {
  if (!g._pgPool) g._pgPool = initPool()
  return g._pgPool
}

export async function query<T = Record<string, unknown>>(
  sql: string, params?: unknown[]
): Promise<T[]> {
  try {
    const pool = await getPool()
    return (await pool.query(sql, params)).rows as T[]
  } catch (err) {
    if (isTransientError(err)) {
      console.warn('[db] Transient error, retrying once:', (err as Error).message)
      const pool = await getPool()
      return (await pool.query(sql, params)).rows as T[]
    }
    throw err
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string, params?: unknown[]
): Promise<T | null> {
  try {
    const pool = await getPool()
    return ((await pool.query(sql, params)).rows[0] as T) ?? null
  } catch (err) {
    if (isTransientError(err)) {
      console.warn('[db] Transient error, retrying once:', (err as Error).message)
      const pool = await getPool()
      return ((await pool.query(sql, params)).rows[0] as T) ?? null
    }
    throw err
  }
}

export async function getPoolStats() {
  const pool = await getPool()
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  }
}

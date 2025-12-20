import { NextResponse } from 'next/server'

type RouteHandler = (req: Request, ...args: unknown[]) => Promise<Response>

/**
 * API Performance & Error Monitoring Wrapper
 * 
 * Responsibilities:
 * 1. Latency Tracking: Measures execution time.
 * 2. Error Trapping: Catches unhandled exceptions and returns standardized 500.
 * 3. Logging: Structured logging for observability (ready for Datadog/Sentry).
 * 4. Alerting: Flags slow requests (>1s) or critical errors.
 */

export interface LogEntry {
  type: 'API_METRIC' | 'API_ERROR' | 'SYSTEM_ALERT'
  timestamp: string
  path: string
  method: string
  status?: number
  duration_ms?: number
  ip?: string
  error?: unknown
  metadata?: Record<string, unknown>
}

export type ExternalLogger = (entry: LogEntry) => void

const externalLoggers: ExternalLogger[] = []

/**
 * Register an external logger (e.g., Sentry, Datadog, or custom analytics)
 */
export function registerLogger(logger: ExternalLogger) {
  externalLoggers.push(logger)
}

function dispatchLog(entry: LogEntry) {
  // Console Output (JSON for machine readability in prod, text for dev)
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry))
  } else {
    const color = (entry.status || 0) >= 500 || entry.type === 'API_ERROR' ? '\x1b[31m' : (entry.status || 0) >= 400 ? '\x1b[33m' : '\x1b[32m'
    const reset = '\x1b[0m'
    const statusStr = entry.status ? ` ${entry.status}` : ''
    const durationStr = entry.duration_ms ? ` - ${Math.round(entry.duration_ms)}ms` : ''
    console.log(`${color}[${entry.type}] ${entry.method} ${entry.path}${statusStr}${durationStr}${reset}`)
  }

  // Dispatch to external loggers
  externalLoggers.forEach(logger => {
    try {
      logger(entry)
    } catch (e) {
      console.error('[MONITOR] External logger failed:', e)
    }
  })
}

export function withMonitor(handler: RouteHandler, handlerName?: string): RouteHandler {
  return async (req: Request, ...args: unknown[]) => {
    const start = performance.now()
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method
    const name = handlerName || path

    try {
      const res = await handler(req, ...args)
      
      const duration = performance.now() - start
      const status = res.status

      const logEntry: LogEntry = {
        type: 'API_METRIC',
        timestamp: new Date().toISOString(),
        path,
        method,
        status,
        duration_ms: Math.round(duration),
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
      }

      dispatchLog(logEntry)

      // Performance Alert
      if (duration > 1000) {
        dispatchLog({
          type: 'SYSTEM_ALERT',
          timestamp: new Date().toISOString(),
          path,
          method,
          metadata: { alert: 'SLOW_QUERY', duration_ms: Math.round(duration), handler: name }
        })
      }

      return res

    } catch (error) {
      const duration = performance.now() - start
      
      dispatchLog({
        type: 'API_ERROR',
        timestamp: new Date().toISOString(),
        path,
        method,
        duration_ms: Math.round(duration),
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        metadata: { handler: name }
      })

      return new NextResponse(
        JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            request_id: crypto.randomUUID() // Traceability
          }
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
}

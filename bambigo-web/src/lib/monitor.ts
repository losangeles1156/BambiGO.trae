import { NextResponse } from 'next/server'

type RouteHandler = (req: Request, ...args: unknown[]) => Promise<Response>

/**
 * API Performance & Error Monitoring Wrapper
 * 
 * Responsibilities:
 * 1. Latency Tracking: Measures execution time.
 * 2. Error Trapping: Catches unhandled exceptions and returns standardized 500.
 * 3. Logging: Structured logging for observability (can be piped to Datadog/Sentry).
 * 4. Alerting: Flags slow requests (>1s) or critical errors.
 */
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

      // Structured Log
      const logData = {
        type: 'API_METRIC',
        timestamp: new Date().toISOString(),
        path,
        method,
        status,
        duration_ms: Math.round(duration),
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      }

      // Console Output (JSON for machine readability in prod, text for dev)
      if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify(logData))
      } else {
        const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m'
        const reset = '\x1b[0m'
        console.log(`${color}[API] ${method} ${path} ${status} - ${Math.round(duration)}ms${reset}`)
      }

      // Performance Alert
      if (duration > 1000) {
        console.warn(`[SLOW_QUERY] ${name} took ${Math.round(duration)}ms`)
      }

      return res

    } catch (error) {
      const duration = performance.now() - start
      console.error(`[API_PANIC] ${name} failed after ${Math.round(duration)}ms`, error)

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

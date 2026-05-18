import type { NextRequest } from 'next/server'

export function getRequestCorrelationId(req: NextRequest): string | undefined {
  return req.headers.get('x-vercel-id') ?? req.headers.get('x-request-id') ?? undefined
}

export function logApiRouteError(req: NextRequest, scope: string, err: unknown): void {
  const cid = getRequestCorrelationId(req)
  const prefix = cid ? `[api:${scope}] [${cid}]` : `[api:${scope}]`
  console.error(prefix, err)
}

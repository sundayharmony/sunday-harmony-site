export const MAX_CSP_REPORT_BYTES = 32 * 1024

export async function readCspReport(
  request: Request,
  maxBytes = MAX_CSP_REPORT_BYTES
): Promise<unknown | null> {
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null
  if (!request.body) return null

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let totalBytes = 0
  let body = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        return null
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    return JSON.parse(body)
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

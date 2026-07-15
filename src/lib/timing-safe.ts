import crypto from 'crypto'

export function timingSafeStringEqual(actual: string | null | undefined, expected: string | null | undefined): boolean {
  if (!actual || !expected) return false
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

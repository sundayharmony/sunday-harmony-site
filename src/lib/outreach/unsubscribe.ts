import { createHash, randomBytes } from 'node:crypto'
import { getPublicSiteUrl } from '@/lib/public-site-url'

export function hashUnsubscribeToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createUnsubscribeToken(): string {
  return randomBytes(32).toString('base64url')
}

export function unsubscribeUrl(token: string, siteUrl = getPublicSiteUrl()): string {
  return `${siteUrl.replace(/\/+$/, '')}/unsubscribe/${encodeURIComponent(token)}`
}

export function oneClickUnsubscribeUrl(token: string, siteUrl = getPublicSiteUrl()): string {
  return `${siteUrl.replace(/\/+$/, '')}/api/unsubscribe/${encodeURIComponent(token)}`
}

export function oneClickUrlFromPageUrl(pageUrl: string): string {
  return pageUrl.replace(/\/unsubscribe\//, '/api/unsubscribe/')
}

export function isOneClickUnsubscribeBody(body: string): boolean {
  return /list-unsubscribe=one-click/i.test(body.replace(/\+/g, ' '))
}

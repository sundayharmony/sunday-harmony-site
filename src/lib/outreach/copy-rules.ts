import { prospectCopyLooksInternal } from './observation'

const SENTENCE_DASH = /[—–]|(\s--\s)/
const FORBIDDEN_GEO = /atlantic county|south jersey/i

export function hasSentenceDash(text: string): boolean {
  return SENTENCE_DASH.test(text)
}

export function hasForbiddenGeo(text: string): boolean {
  return FORBIDDEN_GEO.test(text)
}

export function sanitizeGroundedText(text: string): string {
  return text
    .replace(/[—–]/g, ', ')
    .replace(/\s--\s/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function copyIssues(text: string): string[] {
  const issues: string[] = []
  if (hasSentenceDash(text)) issues.push('sentence_dash')
  if (hasForbiddenGeo(text)) issues.push('forbidden_geo')
  if (prospectCopyLooksInternal(text)) issues.push('internal_jargon')
  return issues
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

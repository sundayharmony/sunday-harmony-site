import {
  bureauScoreValue,
  scorePresent,
  sessionBureauScores,
  sessionReportDate,
} from '@/lib/dispute-letters/bureau-coverage'
import { formatProgressDate } from '@/lib/dispute-letters/credit-progress'
import type {
  BureauCode,
  BureauScoreOrigin,
  BureauScores,
  DisputeSessionListItem,
} from '@/lib/dispute-letters/types'

const BUREAU_ORDER: BureauCode[] = ['TUC', 'EXP', 'EQF']

export type ResolvedBureauScores = {
  scores: BureauScores
  origins: Partial<Record<BureauCode, BureauScoreOrigin>>
}

type ScoredSession = {
  session: DisputeSessionListItem
  scores: BureauScores
  reportDate: string
}

function scoredSessionsOldestFirst(sessions: DisputeSessionListItem[]): ScoredSession[] {
  return sessions
    .filter((s) => s.status === 'ready')
    .map((session) => ({
      session,
      scores: sessionBureauScores(session),
      reportDate: sessionReportDate(session),
    }))
    .sort((a, b) => {
      const byReport =
        new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime()
      if (!Number.isNaN(byReport) && byReport !== 0) return byReport
      return new Date(a.session.created_at).getTime() - new Date(b.session.created_at).getTime()
    })
}

function emptyScores(): BureauScores {
  return { tuc: null, exp: null, eqf: null }
}

function assign(scores: BureauScores, bureau: BureauCode, value: number) {
  if (bureau === 'EXP') scores.exp = value
  else if (bureau === 'TUC') scores.tuc = value
  else scores.eqf = value
}

/**
 * Newest known score per bureau across a client's reports.
 * Single-bureau follow-up uploads only carry their own bureau, so each bureau
 * has to be tracked separately instead of trusting one report to hold all three.
 */
export function latestBureauScoreSources(
  sessions: DisputeSessionListItem[]
): Partial<Record<BureauCode, BureauScoreOrigin & { score: number }>> {
  const out: Partial<Record<BureauCode, BureauScoreOrigin & { score: number }>> = {}
  for (const entry of scoredSessionsOldestFirst(sessions)) {
    for (const bureau of BUREAU_ORDER) {
      const score = bureauScoreValue(entry.scores, bureau)
      if (!scorePresent(score)) continue
      out[bureau] = {
        score: score as number,
        session_id: entry.session.id,
        report_date: entry.reportDate,
        file_name: entry.session.file_name,
        from_selected_report: false,
      }
    }
  }
  return out
}

/**
 * Scores to display for a selected report: its own values first, then the most
 * recent value from any other report for bureaus the selected file does not cover.
 */
export function resolveBureauScoresAcrossReports(params: {
  sessions: DisputeSessionListItem[]
  selectedSessionId?: string | null
  /** Scores already loaded for the selected report (e.g. the health payload). */
  selectedScores?: BureauScores | null
}): ResolvedBureauScores {
  const { sessions, selectedSessionId } = params
  const selectedSession = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId) || null
    : null
  const ownScores =
    params.selectedScores ||
    (selectedSession ? sessionBureauScores(selectedSession) : null)

  const scores = emptyScores()
  const origins: Partial<Record<BureauCode, BureauScoreOrigin>> = {}
  const history = latestBureauScoreSources(sessions)

  for (const bureau of BUREAU_ORDER) {
    const own = bureauScoreValue(ownScores, bureau)
    if (scorePresent(own)) {
      assign(scores, bureau, own as number)
      if (selectedSession) {
        origins[bureau] = {
          session_id: selectedSession.id,
          report_date: sessionReportDate(selectedSession),
          file_name: selectedSession.file_name,
          from_selected_report: true,
        }
      }
      continue
    }

    const carried = history[bureau]
    if (!carried) continue
    assign(scores, bureau, carried.score)
    origins[bureau] = {
      session_id: carried.session_id,
      report_date: carried.report_date,
      file_name: carried.file_name,
      from_selected_report: carried.session_id === selectedSessionId,
    }
  }

  return { scores, origins }
}

export function hasAnyBureauScore(scores: BureauScores | null | undefined): boolean {
  return BUREAU_ORDER.some((b) => scorePresent(bureauScoreValue(scores, b)))
}

/** Caption telling staff which upload a carried-forward score came from. */
export function bureauScoreOriginNote(origin: BureauScoreOrigin | undefined): string | null {
  if (!origin || origin.from_selected_report) return null
  return `From ${formatProgressDate(origin.report_date)} report`
}

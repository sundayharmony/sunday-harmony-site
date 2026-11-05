'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CLOSER_QUIZ_PASS_SCORE,
  CLOSER_SOP_MODULE_IDS,
  CLOSER_TRAINING_PDF_PATH,
  applyQuizResult,
  closerSopModules,
  closerSopQuiz,
  closerTrainingComplete,
  emptyTrainingProgress,
  gradeCloserQuiz,
  parseTrainingProgress,
  toggleTrainingModule,
  trainingProgressStorageKey,
  type CloserSopLink,
  type TrainingProgress,
} from '@/lib/training-data'

type CloserSopHubProps = {
  progress: TrainingProgress
  onProgressChange: (next: TrainingProgress) => void
}

export function useCloserTrainingProgress(userId: string) {
  const [progress, setProgress] = useState<TrainingProgress>(emptyTrainingProgress)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!userId) return
    const stored = parseTrainingProgress(
      typeof window === 'undefined' ? null : window.localStorage.getItem(trainingProgressStorageKey(userId))
    )
    setProgress(stored)
    setReady(true)
  }, [userId])

  function persist(next: TrainingProgress) {
    setProgress(next)
    if (typeof window !== 'undefined' && userId) {
      window.localStorage.setItem(trainingProgressStorageKey(userId), JSON.stringify(next))
    }
  }

  return { progress, ready, persist }
}

function DeepLink({ link }: { link: CloserSopLink }) {
  const className =
    'inline-flex items-center justify-center px-3 py-2 rounded-lg border border-brand-border text-xs font-semibold text-brand-text hover:bg-neutral-50 transition-colors'
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
      </a>
    )
  }
  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  )
}

export default function CloserSopHub({ progress, onProgressChange }: CloserSopHubProps) {
  const [expandedId, setExpandedId] = useState<string | null>(closerSopModules[0]?.id ?? null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [grade, setGrade] = useState<ReturnType<typeof gradeCloserQuiz> | null>(null)

  const completedCount = CLOSER_SOP_MODULE_IDS.filter((id) => progress.modulesCompleted.includes(id)).length
  const complete = closerTrainingComplete(progress)

  function toggleModule(moduleId: string) {
    onProgressChange(toggleTrainingModule(progress, moduleId))
  }

  function submitQuiz() {
    const result = gradeCloserQuiz(answers)
    setGrade(result)
    setSubmitted(true)
    onProgressChange(applyQuizResult(progress, result, new Date().toISOString()))
  }

  function retakeQuiz() {
    setSubmitted(false)
    setGrade(null)
  }

  return (
    <div className="space-y-6">
      <div className="bg-accent-soft border border-accent rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="text-sm font-bold text-accent">Closer SOP</div>
          {complete ? (
            <span className="px-2.5 py-1 rounded-full bg-white border border-accent text-[10px] font-bold uppercase tracking-wide text-accent">
              Complete
            </span>
          ) : null}
        </div>
        <p className="text-sm text-brand-muted leading-relaxed">
          Five short modules from the Closer Training Manual, then an eight-question self-check.
          Mark a module done when you have read it. Progress stays in this browser for your login.
        </p>
        <p className="text-xs text-brand-dim mt-3">
          {completedCount} of {CLOSER_SOP_MODULE_IDS.length} modules
          {progress.quizScore != null
            ? ` · last quiz ${progress.quizScore}/${closerSopQuiz.length}`
            : ' · quiz not submitted'}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <DeepLink link={{ href: '/admin/pipeline', label: 'Open Pipeline' }} />
          <DeepLink link={{ href: '/admin/sales-kit', label: 'Open Sales Kit' }} />
          <DeepLink link={{ href: CLOSER_TRAINING_PDF_PATH, label: 'Open training PDF', external: true }} />
        </div>
      </div>

      <div className="space-y-3">
        {closerSopModules.map((module, index) => {
          const isExpanded = expandedId === module.id
          const isDone = progress.modulesCompleted.includes(module.id)
          return (
            <div
              key={module.id}
              className={`rounded-xl border transition-all ${
                isExpanded ? 'bg-gray-50 border-accent' : 'bg-white border-brand-border'
              }`}
            >
              <div className="flex items-start gap-2 p-4">
                <button
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  className={`mt-0.5 w-7 h-7 shrink-0 rounded-full border text-xs font-bold transition-colors ${
                    isDone
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-brand-dim border-brand-border hover:border-accent'
                  }`}
                  aria-pressed={isDone}
                  aria-label={isDone ? `Mark ${module.title} incomplete` : `Mark ${module.title} complete`}
                >
                  {isDone ? '✓' : index + 1}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : module.id)}
                  className="flex-1 min-w-0 flex items-start gap-3 text-left"
                >
                  <span className="text-2xl">{module.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-brand-text">{module.title}</h3>
                    <p className="text-xs text-brand-muted mt-1">{module.summary}</p>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-dim mt-2">
                      SOP {module.sopSections}
                    </div>
                  </div>
                  <span className={`text-brand-dim text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-3 ml-9">
                  <ul className="space-y-2">
                    {module.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-xs text-brand-muted">
                        <span className="text-accent mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {module.links.map((link) => (
                      <DeepLink key={`${module.id}-${link.href}-${link.label}`} link={link} />
                    ))}
                    <button
                      type="button"
                      onClick={() => toggleModule(module.id)}
                      className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-brand-text text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
                    >
                      {isDone ? 'Mark unread' : 'Mark complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-brand-text mb-1">Self-check</h3>
        <p className="text-xs text-brand-muted mb-4">
          Eight questions from the SOP appendix. You need {CLOSER_QUIZ_PASS_SCORE} correct to pass.
          Answers show after you submit.
        </p>
        <div className="space-y-5">
          {closerSopQuiz.map((question, index) => {
            const result = grade?.results.find((item) => item.id === question.id)
            return (
              <fieldset key={question.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <legend className="text-sm font-semibold text-brand-text mb-2">
                  {index + 1}. {question.prompt}
                </legend>
                <div className="space-y-2">
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option.id
                    const showAnswer = submitted && result
                    const isCorrect = option.id === question.correctId
                    const optionClass = showAnswer
                      ? isCorrect
                        ? 'border-accent bg-accent-soft'
                        : selected
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 bg-white'
                      : selected
                        ? 'border-accent bg-accent-soft'
                        : 'border-gray-200 bg-white hover:border-accent'
                    return (
                      <label
                        key={option.id}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs text-brand-muted cursor-pointer transition-colors ${optionClass}`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.id}
                          checked={selected}
                          disabled={submitted}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                          className="mt-0.5"
                        />
                        <span>
                          {option.label}
                          {showAnswer && isCorrect ? ' (correct)' : ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-5">
          {!submitted ? (
            <button
              type="button"
              onClick={submitQuiz}
              disabled={Object.keys(answers).length < closerSopQuiz.length}
              className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit quiz
            </button>
          ) : (
            <button
              type="button"
              onClick={retakeQuiz}
              className="px-4 py-2 rounded-lg border border-brand-border text-xs font-semibold text-brand-text hover:bg-neutral-50 transition-colors"
            >
              Try again
            </button>
          )}
          {submitted && grade ? (
            <p className="text-sm text-brand-muted">
              You scored {grade.score} of {grade.total}.{' '}
              {grade.passed ? 'Passed — nice work.' : `Need ${CLOSER_QUIZ_PASS_SCORE} to pass.`}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

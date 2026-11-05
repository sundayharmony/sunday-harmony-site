import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import path from 'node:path'
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
} from '../training-data'

function allCorrectAnswers(): Record<string, string> {
  return Object.fromEntries(closerSopQuiz.map((question) => [question.id, question.correctId]))
}

describe('closer SOP training data', () => {
  it('ships five modules, an 8-question appendix quiz, and the PDF', () => {
    assert.equal(closerSopModules.length, 5)
    assert.deepEqual(CLOSER_SOP_MODULE_IDS, [
      'how-to-use-admin',
      'packages-pitching',
      'audit-to-agreement',
      'scoring-pipeline',
      'outreach-cadence',
    ])
    assert.equal(closerSopQuiz.length, 8)
    assert.equal(CLOSER_QUIZ_PASS_SCORE, 6)
    assert.equal(CLOSER_TRAINING_PDF_PATH, '/sales-materials/closer-training-sop.pdf')
    const pdf = path.join(process.cwd(), 'public', CLOSER_TRAINING_PDF_PATH.replace(/^\//, ''))
    assert.ok(existsSync(pdf), 'Closer Training Manual PDF is missing')

    const copy = closerSopModules.map((module) => `${module.title} ${module.summary} ${module.bullets.join(' ')}`).join('\n')
    assert.match(copy, /from \$599/i)
    assert.match(copy, /from \$1,799/i)
    assert.match(copy, /\$799\/mo/)
    assert.match(copy, /Custom quote|per quote|by quote/i)
    assert.doesNotMatch(copy, /Bidstack/i)
    assert.ok(closerSopModules.some((module) => module.links.some((link) => link.href === '/admin/pipeline')))
    assert.ok(closerSopModules.some((module) => module.links.some((link) => link.href === '/admin/sales-kit')))
    assert.ok(closerSopModules.some((module) => module.links.some((link) => link.href === CLOSER_TRAINING_PDF_PATH)))
  })

  it('grades the SOP appendix quiz and stores a pass only at 6 of 8', () => {
    const perfect = gradeCloserQuiz(allCorrectAnswers())
    assert.equal(perfect.score, 8)
    assert.equal(perfect.passed, true)

    const almost = gradeCloserQuiz({
      ...allCorrectAnswers(),
      'goal-outreach': 'a',
      'launch-price': 'a',
      cadence: 'a',
    })
    assert.equal(almost.score, 5)
    assert.equal(almost.passed, false)

    let progress = emptyTrainingProgress()
    for (const id of CLOSER_SOP_MODULE_IDS) progress = toggleTrainingModule(progress, id)
    progress = applyQuizResult(progress, almost, '2026-11-05T12:00:00.000Z')
    assert.equal(closerTrainingComplete(progress), false)

    progress = applyQuizResult(progress, perfect, '2026-11-05T12:05:00.000Z')
    assert.equal(progress.quizScore, 8)
    assert.equal(progress.quizPassedAt, '2026-11-05T12:05:00.000Z')
    assert.equal(closerTrainingComplete(progress), true)
  })

  it('parses localStorage progress and keys it per user', () => {
    assert.equal(trainingProgressStorageKey('user-1'), 'sh-training-progress:user-1')
    assert.deepEqual(parseTrainingProgress(null).modulesCompleted, [])
    assert.deepEqual(parseTrainingProgress('not-json').modulesCompleted, [])
    const parsed = parseTrainingProgress(JSON.stringify({
      modulesCompleted: ['how-to-use-admin', 12, 'outreach-cadence'],
      quizScore: 7,
      quizPassedAt: '2026-11-05T12:00:00.000Z',
    }))
    assert.deepEqual(parsed.modulesCompleted, ['how-to-use-admin', 'outreach-cadence'])
    assert.equal(parsed.quizScore, 7)
    assert.equal(toggleTrainingModule(parsed, 'how-to-use-admin').modulesCompleted.includes('how-to-use-admin'), false)
  })

  it('wires Training into nav, Sales Kit, and the Training page without Bidstack', () => {
    const pipeline = readFileSync('src/lib/marketing-pipeline.ts', 'utf8')
    const page = readFileSync('src/app/admin/training/page.tsx', 'utf8')
    const hub = readFileSync('src/components/admin/CloserSopHub.tsx', 'utf8')
    const salesKit = readFileSync('src/app/admin/sales-kit/page.tsx', 'utf8')
    const materials = readFileSync('src/lib/sales-materials.ts', 'utf8')

    assert.match(pipeline, /href: '\/admin\/training'/)
    assert.match(pipeline, /label: 'Training'/)
    assert.match(pipeline, /path === '\/admin\/training'/)
    assert.match(page, /closer-sop/)
    assert.match(page, /Closer SOP/)
    assert.match(page, /sales_closer/)
    assert.match(hub, /localStorage/)
    assert.match(hub, /trainingProgressStorageKey/)
    assert.match(salesKit, /MATERIAL_CATEGORY_LABELS/)
    assert.match(materials, /id: 'closer-training-sop'/)
    assert.doesNotMatch(page, /Bidstack/i)
    assert.doesNotMatch(hub, /Bidstack/i)
    assert.doesNotMatch(materials, /Bidstack/i)
  })
})

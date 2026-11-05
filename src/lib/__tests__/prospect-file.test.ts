import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('prospect file view mode', () => {
  const source = readFileSync('src/components/admin/ProspectFile.tsx', 'utf8')

  it('opens as a read-only file with an Edit control', () => {
    assert.match(source, /const \[editing, setEditing\] = useState\(false\)/)
    assert.match(source, />\s*Edit\s*</)
    assert.match(source, /function startEdit\(/)
    assert.match(source, /function cancelEdit\(/)
    assert.match(source, /<dl className="grid grid-cols-1 sm:grid-cols-2/)
  })

  it('hides Close until Stripe has confirmed payment', () => {
    assert.match(source, /canSeeCloseSection\(role, stripePaid\)/)
    assert.match(source, /Stripe confirmed payment/)
    assert.match(source, /setStripePaid\(Boolean\(data.stripePaid\)\)/)
  })

  it('keeps pipeline stage editable outside the editor', () => {
    assert.match(source, /function changeStage\(/)
    const stageStart = source.indexOf('<span className="font-medium">Pipeline stage</span>')
    const detailsStart = source.indexOf('{editing ? (', stageStart)
    assert.notEqual(stageStart, -1)
    assert.notEqual(detailsStart, -1)
    const stageBlock = source.slice(stageStart, detailsStart)
    assert.match(stageBlock, /<select/)
    assert.match(stageBlock, /changeStage/)
    assert.doesNotMatch(stageBlock, /\{editing/)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { brandColors, brandMotion, brandSpace, brandType, homeThemeVars, publicColors } from '../brand-tokens'

describe('homepage brand book', () => {
  it('feeds homepage colors, type, motion, and spacing from the tokens', () => {
    const vars = homeThemeVars()
    assert.equal(vars['--home-accent'], brandColors.accent)
    assert.equal(vars['--home-accent-soft'], publicColors.accentSoft)
    assert.equal(vars['--home-text'], publicColors.text)
    assert.equal(vars['--home-bg'], publicColors.bg)
    assert.equal(vars['--home-display'], brandType.display)
    assert.equal(vars['--home-title'], brandType.title)
    assert.equal(vars['--home-ease'], brandMotion.easeCss)
    assert.equal(vars['--home-duration'], `${brandMotion.durationMs}ms`)
    assert.equal(vars['--home-pad-x'], brandSpace.padX)
    assert.equal(vars['--home-section-y'], brandSpace.sectionY)
    assert.ok(brandMotion.lenisLerp > 0 && brandMotion.lenisLerp < 1)
    assert.equal(brandMotion.ease.length, 4)
  })
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  GOOGLE_ADS_ID,
  GOOGLE_ADS_LEAD_CONVERSION,
  GOOGLE_ADS_LEAD_CONVERSION_PAGE,
} from '../google-ads'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('google ads lead conversion', () => {
  it('wires Submit lead form click + page conversion ids into lead success handlers', () => {
    assert.equal(GOOGLE_ADS_ID, 'AW-18542732062')
    assert.equal(GOOGLE_ADS_LEAD_CONVERSION, 'AW-18542732062/vVpbCNy496wdEJ7G7olf')
    assert.equal(GOOGLE_ADS_LEAD_CONVERSION_PAGE, 'AW-18542732062/WxnYCL6iga0dEJ7G7olF')

    assert.match(source('src/lib/google-ads.ts'), /GOOGLE_ADS_LEAD_CONVERSION_PAGE/)
    assert.match(source('src/components/GoogleAdsTag.tsx'), /GOOGLE_ADS_LEAD_CONVERSION/)
    assert.match(source('src/components/GoogleAdsTag.tsx'), /gtag_report_conversion/)

    for (const path of [
      'src/components/ContactForm.tsx',
      'src/components/credit-funding/CreditFundingForm.tsx',
      'src/components/contact/ConsultationBooker.tsx',
    ]) {
      assert.match(source(path), /reportGoogleAdsLeadConversion/)
    }
  })
})

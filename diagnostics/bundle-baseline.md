# Bundle baseline (audit remediation)

Generated as part of site audit remediation. Run locally:

```bash
npm install --save-dev @next/bundle-analyzer
# Add to next.config.js: const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' })
ANALYZE=true npm run build
```

## Heavy client bundles (known)

| Route / feature | Package | Mitigation applied |
|-----------------|---------|-------------------|
| `/credit-funding` | CreditFundingForm (~900 lines) | `next/dynamic` on page |
| `/case-studies` | `pdfjs-dist` | Dynamic `CaseStudyPdfSheet`, server-fetched studies |
| `/admin/marketing-graphics` | `html-to-image` | Recommend dynamic editor import |
| Global | Montserrat 7→4 weights | Trimmed in `layout.tsx` |

## Public vs admin

Public marketing pages should remain mostly Server Components; admin/dashboard pages are intentionally client-heavy for CRUD UIs.

# Cross-bureau Round 1/2 strategy + admin PDF + Gemini Basis

## Locked product rules

- Round 1: letters to **all three bureaus**, **≤7 items per letter**.
- Round 1 priority: **cross-bureau inconsistencies first** (evidence-grounded).
- Round 2+: focus **consistent-across-reporting-bureaus inaccuracies** after mismatches are resolved/aligned.
- **Absent reporting is not proof of error** (single-bureau presence ≠ inconsistency).
- Letter shell (identity, DOB, full SSN when linked, typed name + cursive closing) stays deterministic templates.
- Gemini: weak report-read fallback + optional **confirmed-facts-only** Basis rewrite; Cursor runtime agents stay **OFF**.
- Admin-only staff PDF from ops playbooks; never public assets / non-admin.

## Phases

0. Plan + ops digest + fixtures A/B/C  
1. Admin-only PDF  
2. Tags + Round 1/2 sort  
3. TS+Python reason templates + training/playbook align  
4. Gemini mock extract + facts-only Basis  
5. Credit Intelligence / confirm UI  
6. Full regression (unit/pytest/build; browser when secrets allow)

## Acceptance

See phase gates in commits and tests under `cross-bureau` / `ops-playbooks` / `gemini-basis`.

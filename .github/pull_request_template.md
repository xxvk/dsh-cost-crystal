## Problem and scope

Describe the cost/usage problem and the intentionally limited scope of this change.

## Behavior and safety

- [ ] `npm test` passes (tsc build + `node --test` + line rules).
- [ ] Host logic, pricing, usage, or injected-script changes are made only in the handwritten sources; generated files (`src/card-script.ts`, `src/cost-script.ts`, `lib/`) are regenerated, never hand-edited.
- [ ] String-slice injection is used instead of `String.replace` where the injected script contains `$`.
- [ ] Tests do not contact a live DeepSeek Harness account or mutate user data.
- [ ] Logs, fixtures, and examples contain no credentials or private usage data.

## Verification

List the failing test added first (TDD) and the checks that now pass.

## Documentation

- [ ] README / README_CN / ROADMAP / TODO / CHANGELOG was updated where relevant.
- [ ] No documentation update is needed.

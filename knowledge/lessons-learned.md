# Lessons Learned — Myholiday

> Incident root causes and patterns specific to Myholiday.
> Master-level lessons: `Master/knowledge/lessons-learned.md`.
> When a lesson derives from a Master-level pattern, cross-reference `Master L##`.

## Lessons

#### L01: Post-audit fixes shipped in recovery bundle without running journey audit afterward
- **Date**: 2026-04-24
- **Category**: Audit / Verification
- **Lesson**: Recovery commit `045283b` included post-audit fix work on top of 20d-stale WIP. The fixes were originally driven by a prior E2E/journey audit finding, but after shipping the bundle I did NOT rerun the journey audit to confirm the findings are cleared. `npm run build` passed, but build-passing ≠ audit-passing (L01 pattern in Master: "verification ritual — re-run the original failing test after fix"). Myholiday is pre-deployment (not on Vercel/VPS yet), so the verification gap has no live impact today, but the habit is wrong.
- **Action**: (1) **Phase 1b** (next session): rerun `npx @aledan007/tester journey-audit` against local `npm run dev` on Myholiday. Compare OK/GATED/EMPTY/HAS_ERRORS counts against the last pre-fix baseline. Any status regression → flag before considering the audit-loop closed. (2) **Going forward**: any commit containing audit-driven fixes MUST be followed by rerun of the same audit tier. "Fixes + build green" is insufficient. (3) Cross-ref Master `feedback_verification_ritual` memory — this generalizes.

#### L02: Small repo + no production deploy means audit findings accumulate silently
- **Date**: 2026-04-24
- **Category**: Ops / Staleness
- **Lesson**: Myholiday appears under "Local Only" in DEPLOY_REGISTRY.md — no Vercel, no VPS. Because there's no live URL to monitor, quality signals (journey failures, lint warnings, outdated deps) accumulate without anyone feeling the pain. The 20-day STALE_WIP was invisible until Optimise auditor surfaced it. Without a forcing function (deploy = fails publicly), cleanups get deferred indefinitely.
- **Action**: (1) **Add Myholiday to Optimise scan** (already in — confirmed via 2026-04-24 report listing it). (2) **Deploy decision**: either (a) commit to Vercel/VPS deploy with a public URL + smoke checks, or (b) archive to CLASSIFICATION DEPRECATED if product direction has drifted. Decision cannot be indefinite — sitting in limbo is the worst state. (3) If kept local, add a `make audit` or `npm run quality` target that runs lint + tsc + journey audit in one command. Makes self-discipline cheaper.

---

## How to Add New Lessons

1. Identify the lesson from your project work
2. Add it under an appropriate category
3. Follow the format above
4. Cross-reference Master L## if the pattern applies broadly

Claude should update this file automatically when significant lessons are learned during development.

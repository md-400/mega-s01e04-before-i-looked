# KEEP

## Can run
<!-- keep:can-run:start -->
```
checked by keep-check.mjs on linux x64
found: node at ~/MEGA.dev/.tools/node-v24.22.3-linux-x64/bin/node
found: npm at ~/MEGA.dev/.tools/node-v24.22.3-linux-x64/bin/npm
found: python3 at /usr/bin/python3
found: gh at /usr/bin/gh
found: git at /usr/bin/git
found: curl at /usr/bin/curl
found: corepack at ~/MEGA.dev/.tools/node-v24.22.3-linux-x64/bin/corepack
```
<!-- keep:can-run:end -->

## Findings
- Workers must use separate branches and record done, worker and commit in closing comments. · source: AGENTS.md:15-27 · how: read
- Preview HTML and lane markers must stay out of git and the public URL must be replaced without its marker after review. · source: docs/adr/0003-previews-are-public-and-short-lived.md:13-17 · how: read
- The human approved all eight proposed issues and Scope, Done when, Blocked by and Verification fields. · source: human · how: told
- The human approved local pnpm and dependency installation plus GitHub Pages via Actions and first publication, but not the later marker-free overwrite. · source: human · how: told
- OpenCode loaded plan-to-issues directly from the repo's shared skill source after moving this session into the repo. · source: .agents/skills/plan-to-issues/SKILL.md:1-42 · how: read
- Integrated HTML and JSON preserve one shared reader ordering, including mixed-case and accented job names. · source: src/views/digest.tsx:4-5 · how: read
- The manual Pages workflow exports outside git, uses a caller-supplied marker and keeps the deployment artifact for one day. · source: .github/workflows/preview.yml:3-60 · how: read
- The integrated suite passes all 55 tests and TypeScript typecheck. · source: KEEP.md:Receipts · how: ran
- The course accepted the preview submission, but review and marker cleanup are still pending; the Challenge is not solved. · source: KEEP.md:Receipts · how: ran

## Receipts

command: corepack pnpm test; corepack pnpm typecheck
```text
$ vitest run

 RUN  v5.1.0 /home/mmm/MEGA.dev/s01e04/mega-s01e04-before-i-looked


 Test Files  5 passed (5)
      Tests  55 passed (55)
   Start at  17:32:06
   Duration  1.27s (tests 47%, import 30%, transform 19%, worker 4%)

    Isolate  5 workers spawned · ~117ms startup each (spawn + environment, per file)
             at least ~467ms faster with isolate: false — reuses workers across files instead of one per file

$ tsc --noEmit
```

from: mega-challenge.claim-challenge, first preview submission
```text
Sent to the reviewer, who will look at the preview in a few minutes. Not solved yet.
```

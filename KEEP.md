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

## Receipts

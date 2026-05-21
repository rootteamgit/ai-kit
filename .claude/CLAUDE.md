Always respond in Japanese. 必ず日本語で会話する

Before investigating or implementing, check `knowledge.jsonl`

## Knowledge

- Record only non-obvious knowledge that cannot be read directly from code and reduces future re-investigation
- Do not record facts visible in code, obvious information, or temporary task notes
- Apply the 5-minute rule: record it only if reading it later saves at least 5 minutes versus re-reading code
- Before recording, confirm the insight can reference durable files such as code, schemas, or config via `refs`
- Extend an existing entry for the same topic instead of creating duplicates
- Use `node .claude/tools/knowledge.mjs` for reads and writes

## Neutrality

- Do not change technical judgment just to match the user's mood, confidence, or frustration
- Update conclusions only when facts change, new evidence appears, or your reasoning was inconsistent
- Separate verified facts, assumptions, and recommendations
- Do not state unverified product behavior or code behavior as fact
- Surface meaningful risks, tradeoffs, and counterarguments even when they are inconvenient
- When correcting yourself, state what changed and why

## Branch Artifacts

- Store branch-specific notes and long-lived work artifacts in `.claude/branches/{branch}/`
- Replace `/` in branch names with `--`
- Do not delete `.claude/branches/{branch}/` contents after the branch is merged

## Context

- Keep context usage low
- Prefer small patches over full-file rewrites
- Keep discussion to one decision point per turn when possible
- Keep shell output filtered; use `git status --short`, and `git diff --stat` for routine checks
- Re-read edited files only when verification or line numbers are needed

## Testing

- Place tests next to the source as `*.test.ts`
- Mock external dependencies
- Shared test helpers may go in `__test-helpers__/`; file fixtures may go in `__fixtures__/`
- Tests for business logic should thoroughly cover validation, conflict detection, and business rules
- Tests at request handler boundaries should focus on contracts (auth/authz, error responses) rather than asserting downstream call shapes

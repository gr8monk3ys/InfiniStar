## AI Prompt Eval Suite

These tests guard the structural and content invariants of InfiniStar's roleplay
prompt assembly pipeline — the code that turns a Character record, stored
memories, and a personality preset into the system prompt the model receives.
Because the product's value is conversation quality (characters that stay in
character, memories that surface naturally, personalities that are distinct), a
silent regression in this assembly layer is high-severity even if no other test
catches it. The three test files cover:

- **character-prompt.eval.test.ts** — `buildCharacterSystemPrompt`: asserts
  that the scenario, example-dialogue framing ("match their voice… do not copy
  verbatim"), and all five roleplay guardrails (stay in character, never write
  for the user, asterisk actions, match pacing, OOC handling) are present for
  a full character fixture; asserts that a minimal character (no scenario/
  examples) still gets the guardrails without emitting empty section headers;
  and asserts that an unnamed character uses generic phrasing rather than
  "as null".

- **memory-context.eval.test.ts** — `buildMemoryContext`: asserts category
  grouping, bullet-list rendering, the "Weave this context in naturally / Do
  not recite" instruction, and that an empty memory array produces an empty
  string. A dedicated prompt-cache-stability test verifies that repeated calls
  with identical key-sorted input produce byte-identical output (the sort
  contract belongs to `getRelevantMemories`, which sorts by key before handing
  the array to `buildMemoryContext`; a broken sort would invalidate the
  Anthropic prefix cache on every turn and silently inflate costs).

- **personalities.eval.test.ts** — `AI_PERSONALITIES` / `getSystemPrompt`:
  asserts all 8 personalities have non-empty, mutually distinct system prompts;
  `getSystemPrompt("custom", userText)` returns the user text verbatim;
  unknown or empty personality IDs fall back to the assistant preset rather
  than returning an empty or undefined prompt.

**To add a "golden character" case**: create a new fixture object at the top of
`character-prompt.eval.test.ts` (or a shared `fixtures/` file under this
directory) and add a `describe` block that calls `buildCharacterSystemPrompt`
with it, then asserts whatever domain-specific strings that character must
include (e.g., a pirate character must reference nautical vocabulary in the
rules block, or a therapist character must include a safety disclaimer in its
system prompt).

**Live behavioral eval (out of scope here)**: testing that the assembled prompt
causes the model to actually stay in character — e.g., that it never speaks as
the user — requires a real Anthropic API call, costs money, and is
non-deterministic. That level of eval is intentionally excluded from this
suite and would belong in a separate opt-in script gated behind the
`E2E_RUN_LIVE_AI=true` environment variable (see `.env.ci.example`).

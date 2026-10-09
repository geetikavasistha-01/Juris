# Rules for AI coding agents on Juris

1. Read docs/prd.md, docs/prd-v2.md, docs/system-context.md, docs/roadmap.md, docs/known-gaps.md, and docs/adr/ before changing anything. If a decision is not recorded, ask the human; do not invent.
2. Work on one slice at a time. Do not touch files outside the slice scope.
3. Contracts first: change packages/shared before the API or web code. No duplicated types.
4. Tests first. A task is not done until tests pass in CI and the code was run against real data.
5. A passing build proves nothing. Report what you ran, what you saw, and what you could not verify.
6. Never print, echo, log, or pass secrets in commands or output. Read them from the environment only. Never use a VITE_ variable for anything secret.
7. No mock, simulated, or invented data in product code. Fixtures and recorded LLM responses are allowed in tests only.
8. Never mark evaluation items approved; only the human review tool can.
9. Errors must use the shared error envelope and codes. Never retry non-retryable errors. No silent fallbacks.
10. Keep provider, model, limits, and TTLs in configuration, not in UI text or constants.
11. Small commits with clear messages. Do not rewrite git history.
12. Finish every task with docs/evidence/<slice>.md: commands run (secrets redacted), observed results, screenshots, and a "not verified" list.
13. Stay inside the repository. Never search the home directory, read the clipboard, read other projects' or other tools' data, or modify files outside the repo (including IDE and MCP configuration). If a needed file is missing, stop and ask.
14. Never run destructive commands (git reset --hard, git clean, git checkout -- ., force push, amend or rebase of existing commits, rm -rf outside a scratch folder) without my explicit approval. To test a hook, use a new branch with only the test file staged.
15. List every side effect (files changed outside the task scope, packages installed, processes started or stopped) under "Side effects" in the evidence file.

---
name: File writes can silently revert in this workspace
description: Edits made via write/edit tools have twice vanished from disk mid-session; always re-verify before typecheck/test.
---

Twice in one session (July 2026), files written or edited successfully (tool reported success) later disappeared or reverted to their pre-edit state on disk — a newly created page file vanished entirely, and appended test cases + an import edit reverted.

**Why:** Unknown root cause (possibly checkpoint/rollback interaction). The tool success message is not proof the change persisted.

**How to apply:** After writing/editing files and before running typecheck or tests, verify the change is actually on disk (`ls` for new files, `grep` for edited content). If a verification step fails with "module not found" or an old test count, suspect a revert and re-apply rather than debugging the code itself.

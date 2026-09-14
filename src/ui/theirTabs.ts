/**
 * Their pull request tab row — Conversation, Commits, Checks, Files changed.
 *
 * The one place this label lives. The conversation place reads it to hide the row when
 * ours is up, which is the only thing anything does with it now. GitHub rewords it —
 * "Pull request navigation tabs" became "Pull request navigation" on 2026-09-01 — and a
 * copy of the label in each reader is a rename that fixes one and leaves the other,
 * which is exactly what happened once.
 *
 * The way back out of GitHub's page used to stand at the end of this row, dressed as the
 * tabs beside it. It is `src/ui/wayBack.ts` now, and in front of the page rather than
 * inside it: sixteen of the twenty-one pages this extension draws have no tab row, so a
 * reader who turned the interface off on any of them was offered nothing anywhere.
 */
export const THEIR_TABS = '[aria-label="Pull request navigation"]'

/**
 * Attributes that one host writes and another reads.
 *
 * A mark like this is a contract between two programs that never call each other, so
 * the string lives in one place and both sides import it. Written out three times —
 * once in the markup, once in the rule, once in a test — it is a contract nothing
 * checks, and renaming any one copy kills the control in silence. Which is the fault
 * that put the first of these here.
 */

/**
 * That this link means the reader's browser, whichever page it points at.
 *
 * Only the window reads it, and there it is the difference between a control that works
 * and one that does nothing: in that window no link is followed, and a link to a pull
 * request is that pull request being drawn. The card's own external-link mark points at
 * the pull request already on the screen, so without saying this it was answered by
 * drawing that screen again, which looks exactly like a press that did not land. The
 * rule is `desktop/src/view/where.ts`.
 *
 * Not `data-gitquiet-outside`, which `outside.ts` already owns for markup drawn outside
 * our own root: a second meaning for it would also hand this anchor a stylesheet
 * written for GitHub's HTML.
 */
export const BROWSER = "data-gitquiet-browser"

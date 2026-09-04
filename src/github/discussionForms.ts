/**
 * Writing on a discussion, by sending back the form GitHub put on the page.
 *
 * Their discussion page is Rails, and every control on it that changes something is a form. So a
 * write here is what `saying.ts` does for a pull request's comment box, generalised: find the
 * form, keep every field it carries, add the reader's own value, and post it. The token has to
 * come from the page and cannot be minted — it is signed for this render of this form — and that
 * is a constraint of the platform rather than a shortcut. The extension is on the page. The form
 * is right there. The reason the token exists is to be sure a request came from somewhere that
 * had loaded the page, and this one did.
 *
 * ## What is verified and what is not
 *
 * The mechanism is verified. `vercel/next.js/discussions/70178` served on 2026-09-03 carries one
 * form even to a reader who is not signed in:
 *
 * ```html
 * <form class="js-timeline-marker-form" action="/_graphql/MarkNotificationSubjectAsRead"
 *       method="post"><input type="hidden" name="authenticity_token" value="…">
 *   <input type="hidden" name="variables[subjectId]" value="D_kwDOBC3Cis4AbdMx"></form>
 * ```
 *
 * So: a path per operation, `variables[…]` fields, a CSRF token, urlencoded.
 *
 * The forms this file goes looking for are not verified, because GitHub renders none of them to
 * a reader who is not signed in and there is no recording of a signed-in discussion in this
 * repository. Each one is anchored to a hook that *is* in the served markup — the vote button's
 * id, the answer badge's class, a comment's own container — and asked for the form around it.
 * Nothing guesses at a route name or a field name: whatever the form says is what is sent.
 *
 * The consequence of being wrong is bounded and is the one this codebase already accepts for the
 * pull request box: the form is not found, the control is not offered, and the reader has
 * GitHub's own page a press away. It is never a write sent somewhere it should not go.
 */

/** One of their forms, as much of it as sending it back needs. */
export type Posting = {
  /** Where it posts, as their markup gives it. */
  readonly action: string
  /** Every hidden field it carries, under their own names. */
  readonly fields: Readonly<Record<string, string>>
  /**
   * The name of the field the reader's words go in, or nothing where the form takes none.
   *
   * Read off the form rather than assumed, because their name for it is theirs: a press that
   * marks an answer sends no words at all, and the box at the foot of the page sends them under
   * whatever `name` their textarea has today.
   */
  readonly bodyField: string | null
}

/**
 * One of their forms read whole, or nothing where it is not one that posts.
 *
 * A form with no action is not a form this can send. A form that GETs is a search box, and
 * sending one as a write would be a request that does nothing and reports success.
 */
export const postingOf = (form: Element | null): Posting | null => {
  const action = form?.getAttribute("action") ?? null
  if (form === null || action === null || action === "") return null
  if ((form.getAttribute("method") ?? "get").toLowerCase() !== "post") return null

  const fields: Record<string, string> = {}
  for (const input of [...form.querySelectorAll('input[type="hidden"][name]')]) {
    const name = input.getAttribute("name") ?? ""
    const value = input.getAttribute("value") ?? ""
    // Their markup carries repeated blank-named hidden inputs beside the real ones. A name is
    // what makes a field a field, so the nameless ones are left where they are.
    if (name !== "") fields[name] = value
  }

  const box = form.querySelector("textarea[name]")

  return { action, fields, bodyField: box?.getAttribute("name") ?? null }
}

/** The form the given control sits in, whichever ancestor that is. */
const around = (node: Element | null): Element | null => node?.closest("form") ?? null

/**
 * The comment container for one comment, by GitHub's own name for it.
 *
 * The container and not the scroll target, because the controls sit beside the body rather than
 * inside the element the id is on.
 */
const containerOf = (page: Document, commentId: string): Element | null =>
  page.getElementById(`discussioncomment-${commentId}`)?.closest(".js-comment-container") ?? null

/**
 * The box at the foot of the page, for saying something on the discussion itself.
 *
 * Found by the textarea rather than by the action, for the reason `saying.ts` gives about a pull
 * request: the field is the thing a reader is looking at, and their route for it has moved
 * before now. Nothing where the reader is not signed in, where the discussion is locked, or
 * where the repository is archived — GitHub renders no box in any of those, and a box that
 * throws when it is used is worse than no box.
 */
export const sayingOn = (page: Document): Posting | null => {
  for (const box of [...page.querySelectorAll("textarea[name]")]) {
    // Not a reply box: those sit inside a comment, and this one is the page's own.
    if (box.closest(".js-comment-container") !== null) continue

    const posting = postingOf(around(box))
    if (posting !== null) return posting
  }

  return null
}

/** The box under one comment, for replying to it rather than to the discussion. */
export const replyingUnder = (page: Document, commentId: string): Posting | null => {
  const container = containerOf(page, commentId)
  if (container === null) return null

  for (const box of [...container.querySelectorAll("textarea[name]")]) {
    const posting = postingOf(around(box))
    if (posting !== null) return posting
  }

  return null
}

/**
 * The press that marks one comment as the answer, or takes the mark off it.
 *
 * Anchored to `.social-mark-answer`, which is on the page whether or not the reader may press
 * it: on the answered discussion recorded here it is a disabled button reading "Marked as
 * answer". Disabled is exactly the case that must not be offered, so it is refused.
 */
export const markingAnswer = (page: Document, commentId: string): Posting | null => {
  const container = containerOf(page, commentId)
  const button = container?.querySelector(".social-mark-answer") ?? null
  if (button === null || button.hasAttribute("disabled")) return null

  return postingOf(around(button))
}

/**
 * The press that upvotes the discussion, or one comment of it.
 *
 * Anchored to the id their vote button carries, which is the one hook on this page that names
 * both what is being voted on and which of the two kinds it is:
 * `discussion-upvote-button-Discussion-7197489` for the question,
 * `discussion-upvote-button-DiscussionComment-11004713` for something said about it.
 *
 * Refused while it is disabled, which is what a reader who is not signed in gets: their page
 * draws the count and a tooltip reading "You must be logged in to vote".
 */
export const upvoting = (
  page: Document,
  kind: "Discussion" | "DiscussionComment",
  id: string
): Posting | null => {
  const button = page.getElementById(`discussion-upvote-button-${kind}-${id}`)
  if (button === null || button.hasAttribute("disabled")) return null

  return postingOf(around(button))
}

/**
 * One of their forms as the body of a POST, with the reader's words put in it.
 *
 * Their own fields first and in their own order, because that is the order their page sends them
 * and there is no reason to be the one request that differs. The words go last, under the name
 * the form gave, and a form that takes no words takes none.
 *
 * Not `saying.ts`'s `asForm`, and named apart from it so nobody reads the two as one function.
 * That one is narrower on purpose: it insists on four named fields and posts the body under
 * `comment[body]`, because a pull request's box is one form whose shape is known and a missing
 * field there is worth failing over. This one is given whichever of four forms a press needs and
 * has to take their word for every part of it.
 */
export const sendingOf = (posting: Posting, said?: string): string => {
  const body = new URLSearchParams()
  for (const [name, value] of Object.entries(posting.fields)) body.set(name, value)
  if (posting.bodyField !== null && said !== undefined) body.set(posting.bodyField, said)

  return body.toString()
}

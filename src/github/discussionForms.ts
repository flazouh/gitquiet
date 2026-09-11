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

import type { Doing } from "../domain/discussions"
import { text } from "./outcome"
import type { DiscussionPress } from "@/domain/discussions"

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

/**
 * How a Poll is answered, which their own markup names outright.
 *
 * The one write on this screen that guesses at nothing. Their poll carries `data-vote-url`, the
 * radio group carries the poll's id as its `name`, each option carries its own id as `value`,
 * and the token sits beside them in `.js-data-url-post-csrf`. So the address, the field and the
 * value are all read rather than assumed.
 *
 * Refused where their own vote button is missing or hidden, which is what a reader who is not
 * signed in gets, and what a locked poll gets.
 */
export const votingIn = (page: Document, option: string): Posting | null => {
  const poll = page.querySelector(".js-discussion-poll-component")
  const action = poll?.getAttribute("data-vote-url") ?? ""
  if (poll === null || action === "" || poll.getAttribute("data-poll-locked") === "true") {
    return null
  }

  const button = poll.querySelector(".js-discussion-poll-vote-button")
  if (button === null || button.hasAttribute("hidden") || button.hasAttribute("disabled")) {
    return null
  }

  const chosen = poll.querySelector(`.js-discussion-poll-option[value="${option}"]`)
  const field = chosen?.getAttribute("name") ?? ""
  const token = poll.querySelector(".js-data-url-post-csrf")?.getAttribute("value") ?? ""
  if (field === "" || token === "") return null

  return { action, fields: { authenticity_token: token, [field]: option }, bodyField: null }
}

/**
 * The press that puts one of the eight faces on something, or takes it off again.
 *
 * Their own button, found by the name GitHub gives the face rather than by the character: the
 * character is what a reader sees and `+1` is what the server is told. Every one of these is a
 * `type="submit"` inside a form, and a submit button's own `name` and `value` are part of what a
 * form sends — so both are added to the form's hidden fields here, exactly as a browser would.
 *
 * Refused while it is disabled, which is every reader who is not signed in.
 */
export const reactingTo = (within: Element | null, content: string): Posting | null => {
  const button =
    within?.querySelector(`.js-reaction-group-button[data-reaction-content="${content}"]`) ?? null
  if (button === null || button.hasAttribute("disabled")) return null

  const posting = postingOf(around(button))
  const name = button.getAttribute("name") ?? ""
  const value = button.getAttribute("value") ?? ""
  if (posting === null || name === "" || value === "") return null

  return { ...posting, fields: { ...posting.fields, [name]: value } }
}

/**
 * Where the faces on one thing are: the discussion's own body, or one comment.
 *
 * The opening post is a comment container like the others, so both are asked for the same way and
 * the caller says which by giving the id GitHub uses for it.
 */
export const reactionsWithin = (
  page: Document,
  kind: "Discussion" | "DiscussionComment",
  id: string
): Element | null => {
  const target = page.getElementById(
    kind === "Discussion" ? `discussion-${id}` : `discussioncomment-${id}`
  )

  return target?.closest(".js-comment-container") ?? null
}

/**
 * Where GitHub keeps the menu of everything else a reader may do to one thing.
 *
 * Close, lock, edit, delete, report and whatever they ship next are all in it, and none of them
 * is in the page: their markup carries an `include-fragment` per comment whose `src` is the route
 * that serves the menu, loaded when somebody opens it.
 *
 * So the route is read off the page rather than built. That is the difference between this and a
 * guess: `/discussions/70178/actions_menu?form_path=…` and
 * `/discussions/70178/comments/10935238/comment_actions_menu?form_path=…` are GitHub's own
 * strings, sitting in their own markup, and this codebase never writes either of them.
 */
export const menuRouteIn = (
  page: Document,
  kind: "Discussion" | "DiscussionComment",
  id: string
): string | null => {
  const within = reactionsWithin(page, kind, id)
  const fragment = within?.querySelector('include-fragment[src*="actions_menu"]') ?? null
  const src = fragment?.getAttribute("src") ?? ""

  return src === "" ? null : src
}

/** One entry of their menu, and the form behind it. */
const entriesIn = (html: string): ReadonlyArray<{ said: string; form: Element }> => {
  const menu = new DOMParser().parseFromString(html, "text/html")

  return [...menu.querySelectorAll("form")].flatMap((form) => {
    const control = form.querySelector("button, summary, [role='menuitem']")
    const said = text(control).replace(/\s+/g, " ")

    return said === "" ? [] : [{ said, form }]
  })
}

/**
 * Everything their menu offers, in their own words and their own order.
 *
 * A form with no readable control is left out: it is a thing this could send and could not name,
 * and a button with no label is a press nobody can decide to make.
 */
export const doingsIn = (html: string): ReadonlyArray<Doing> =>
  entriesIn(html).map(({ said, form }) => ({
    said,
    /*
     * Their own word for destructive, where they use one. Read rather than decided: this
     * codebase does not know which of their entries deletes something, and guessing would be
     * either a warning on the wrong press or none on the right one.
     */
    danger: form.querySelector('[class*="danger"], [class*="Danger"]') !== null
  }))

/** The form behind one entry, found by the words on it. */
export const doingNamed = (html: string, said: string): Posting | null => {
  const found = entriesIn(html).find((entry) => entry.said === said)
  if (found === undefined) return null

  const posting = postingOf(found.form)
  if (posting === null) return null

  /*
   * A submit button's own name and value are part of what a form sends, and their menus use one
   * to say which of several things a shared form is doing. Added the way a browser would.
   */
  const control = found.form.querySelector("button[name][value]")
  const name = control?.getAttribute("name") ?? ""
  const value = control?.getAttribute("value") ?? ""

  return name === "" ? posting : { ...posting, fields: { ...posting.fields, [name]: value } }
}

/**
 * What one press sends, chosen by its kind.
 *
 * A `switch` over the union rather than a chain of conditions, exactly as `COURT_OF_INVOLVEMENT`
 * is a lookup: an eighth kind added to `DiscussionPress` without a form decided for it is then a
 * compile error, where the chain this replaces ended in a bare `else` that would have posted an
 * upvote for it.
 *
 * `said` travels beside the form because only two kinds carry words, and the caller would
 * otherwise ask a second time which two they are.
 *
 * A menu entry is the one press whose form is not on the page. Its markup arrives already
 * fetched, in `menu`, because reading it is a network call and this is not the place for one.
 */
export const sending = (
  page: Document,
  press: DiscussionPress,
  menu: string | null
): { readonly posting: Posting | null; readonly said: string | undefined } => {
  switch (press.kind) {
    case "say":
      return { posting: sayingOn(page), said: press.body }
    case "reply":
      return { posting: replyingUnder(page, press.comment), said: press.body }
    case "mark-answer":
      return { posting: markingAnswer(page, press.comment), said: undefined }
    case "vote":
      return { posting: votingIn(page, press.option), said: undefined }
    case "react":
      return {
        posting: reactingTo(reactionsWithin(page, press.on, press.id), press.content),
        said: undefined
      }
    case "upvote":
      return { posting: upvoting(page, press.on, press.id), said: undefined }
    case "doing":
      return { posting: menu === null ? null : doingNamed(menu, press.said), said: undefined }
  }
}

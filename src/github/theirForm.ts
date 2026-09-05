/**
 * One of GitHub's own forms, read off the page so it can be sent back.
 *
 * The Rails half of GitHub — discussions, gists — puts a form on the page for every
 * control that changes something, and a write from this extension is that form sent
 * back with the reader's own value in it. The token has to come from the page and cannot
 * be minted: it is signed for this render of this form, which is a constraint of the
 * platform and not a shortcut. The extension is on the page. The form is right there.
 *
 * Shared by every reader of such a form, so that there is one idea of what a form is
 * rather than one per page that has them.
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
 * field there is worth failing over. This one is given whichever form a press needs and has to
 * take their word for every part of it.
 */
export const sendingOf = (posting: Posting, said?: string): string => {
  const body = new URLSearchParams()
  for (const [name, value] of Object.entries(posting.fields)) body.set(name, value)
  if (posting.bodyField !== null && said !== undefined) body.set(posting.bodyField, said)

  return body.toString()
}

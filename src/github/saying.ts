/**
 * Saying something about the pull request, the way GitHub's page still does it.
 *
 * Every other write in this gateway is a JSON POST to a `page_data` route, because
 * that is what GitHub's own bundle sends. The conversation box is the exception:
 * the comment field at the foot of their page is a plain form, and posting one is
 * a form submission to `/pull/{n}/comment` — `authenticity_token`, `timestamp`,
 * `timestamp_secret` and the body, urlencoded.
 *
 * Which means the token has to come from the page, and there is nowhere else to
 * get it: it is signed for this render of this form and cannot be minted. That is
 * a real constraint on this platform rather than a shortcut — the extension is on
 * the page, so the form is right there, and the reason the token exists is to make
 * sure a request came from somewhere that had loaded the page. This one did.
 *
 * The reply is the whole page again, 800kb of HTML, and parsing a comment out of
 * it would be a scraper that breaks on their next deploy. So the comment is read
 * back from the route that already reads the conversation, and the newest one by
 * the reader is the one that was just written.
 */

/** One comment as their conversation route lists it, which is all this file needs. */
export type Said = {
  readonly authorLogin: string
  readonly createdAt: string
  readonly isHidden: boolean
}

/** The fields their form carries that are not the body, in the order it lists them. */
export const SIGNED = ["authenticity_token", "timestamp", "timestamp_secret", "issue"] as const

export type Signing = {
  /** Where the form posts, as their markup gives it — path only, query included. */
  readonly action: string
  readonly fields: Readonly<Record<string, string>>
}

/**
 * The form at the foot of GitHub's conversation, read off the page.
 *
 * `null` when it is not there, which is not a fault: the tab a reader is on may be
 * Files or Checks, where GitHub does not render the comment box at all, and a
 * reader who is not signed in never gets one.
 */
export const signingIn = (page: Document): Signing | null => {
  const box = page.getElementById("new_comment_field")
  const form = box === null ? null : box.closest("form")
  const action = form?.getAttribute("action") ?? null
  if (form === null || action === null) return null

  const fields: Record<string, string> = {}
  for (const name of SIGNED) {
    const field = form.querySelector(`input[name="${name}"]`)
    // Their markup has repeated blank-named hidden inputs beside the real ones;
    // named lookups skip those, and a missing named one is worth failing over
    // rather than posting a form GitHub will refuse for a reason nobody can read.
    if (!(field instanceof HTMLInputElement) || field.value === "") return null
    fields[name] = field.value
  }

  return { action, fields }
}

/**
 * The reader's newest remark in the conversation, which is the one just written.
 *
 * By author and not merely last, because the list is everybody's and a colleague
 * who commented while this one was in flight would otherwise be handed back as
 * the reader's own words. Newest by the timestamp GitHub gives rather than by
 * position, since nothing promises the order of that array.
 */
export const newestBy = <A extends Said>(
  login: string | undefined,
  comments: ReadonlyArray<A>
): A | null => {
  const theirs = comments.filter(
    (one) => !one.isHidden && (login === undefined || one.authorLogin === login)
  )
  if (theirs.length === 0) return null

  return theirs.reduce((newest, one) => (one.createdAt > newest.createdAt ? one : newest))
}

/** What the form sends, which is not JSON. */
export const asForm = (signing: Signing, body: string): string => {
  const said = new URLSearchParams()
  for (const [name, value] of Object.entries(signing.fields)) said.set(name, value)
  said.set("comment[body]", body)
  return said.toString()
}

/**
 * The organisation standing between a reader and a page they can see the name of.
 *
 * An organisation may require single sign-on, and until the reader has done it
 * for that organisation GitHub will not serve its repositories to them. The
 * refusal is the part worth knowing about: their document routes answer 200 with
 * a sign-on page in place of the page that was asked for, and their JSON routes
 * answer 401 with no body at all. Neither of those is a payload that changed
 * shape, and both used to be reported as one.
 *
 * Measured on `octo-org/octo-repo`, whose organisation requires it:
 * `GET /octo-org/octo-repo` came back 200, 44kB, titled "Sign in to
 * octo-org", carrying no embedded payload and one form posting to
 * `/orgs/octo-org/saml/initiate`. `GET /octo-org/octo-repo/pulls`
 * as JSON came back 401 with an empty body, where the same route on a repository
 * the reader has signed on for came back 200.
 *
 * Two ways of meeting the same wall, so two halves to this file. {@link signOnWanted}
 * reads a body that was fetched and reports what it found, for a card drawn
 * somewhere else. {@link wallIn} and {@link theirFormAgain} read and answer the wall
 * the reader is actually standing on, which is a live document rather than a string.
 * They are together because they are one set of facts about one page of GitHub's,
 * and the day GitHub changes that page both halves are wrong at once.
 */

import { Option, UndefinedOr } from "effect"

/**
 * Where their sign-on page sends the reader, and the only mention of it there.
 *
 * The organisation's login is in the path, which is what makes this worth
 * reading rather than a boolean: the reader is being asked to sign on somewhere
 * in particular, and a card that cannot name it is asking them to guess.
 *
 * Their `sso_modal` and `sso_status.json` links are on that page too and are
 * deliberately not matched. Both appear on ordinary pages of an organisation
 * the reader has already signed on for.
 */
const INITIATE = /\/orgs\/([^/"'?\s]+)\/saml\/initiate/

/** Where a page of theirs is served from, and the only origin this will post to. */
const THEIRS = "https://github.com"

/**
 * How every one of their auth pages marks itself, on the root element.
 *
 * One constant for the two ways it is read, because it is one fact about one
 * attribute: as a class where there is a document to ask, and as text where there
 * is only a body that was fetched.
 */
export const AUTH_CLASS = "html-auth"

/** The same, as their served HTML spells it. */
const WALLED = `class="${AUTH_CLASS}"`

/**
 * The organisation whose single sign-on this page is, out of the page's HTML.
 *
 * Asked only of a document that was expected to hold a payload and did not,
 * because that is the whole of the ambiguity: a page of theirs with nothing in
 * it for us is either a shape that changed or a wall, and the reader is told
 * something quite different in each case.
 */
export const signOnWanted = (html: string): Option.Option<string> => {
  if (!html.includes(WALLED)) return Option.none()

  const found = INITIATE.exec(html)
  return found === null ? Option.none() : Option.fromNullishOr(found[1])
}

/**
 * Their own page for signing on to an organisation, which is a plain link.
 *
 * Where a card is all there is — a read that failed from a page somewhere else
 * entirely — this is where the reader is sent. The wall itself is not read this
 * way: a document that *is* the wall carries the form and its token, and
 * {@link wallIn} reads both. Measured: `GET /orgs/octo-org/sso?return_to=…`
 * answers 200 with that page.
 */
export const signOnPage = (organisation: string, backTo: string): string =>
  `${THEIRS}/orgs/${organisation}/sso?return_to=${encodeURIComponent(backTo)}`

/**
 * Their wall, as a thing that can be answered rather than only reported.
 *
 * Everything needed to post their own form, because that is what the Continue
 * button on their page does and there is nothing else on it.
 */
export type Wall = {
  /** Who is asking, which is the one thing the card has to say. */
  readonly organisation: string
  /** Where their form posts, kept whole rather than rebuilt from its parts. */
  readonly action: string
  /**
   * Every hidden field of their form, in the order they wrote them.
   *
   * All of them rather than the token alone, because the point is to send what
   * their own button sends. Their form carries `add_account` as well, empty, and
   * a request that leaves out a field their server expects is a request nobody
   * here can predict the answer to. Replaying the form is the one version of this
   * whose behaviour is already known: it is what pressing Continue does.
   */
  readonly fields: ReadonlyArray<readonly [string, string]>
  /** Where the reader was going when this got in the way. */
  readonly backTo: string
}

/**
 * The one box that marks an auth page of theirs as an organisation's wall.
 *
 * Their login box, their second factor and their device check are all served
 * under the same root class, and none of them is an organisation asking to be
 * signed on to. Measured on `OpenRouterIncubator/ori`, where `main` holds
 * exactly one child and it is `div.org-sso.text-center`.
 *
 * Exported because `place.ts` writes the rule that hides their wall while ours is
 * arriving, and that rule has to name the same box this reads. Two spellings of
 * one selector is how a region ends up hidden by a rule nothing is ever going to
 * lift — the 587 milliseconds of somebody else's list that `gateCss.ts` is named
 * after.
 */
export const THE_WALL_BOX = "div.org-sso"

/** The same box, where it stands: their `main` and nowhere else. */
const THE_WALL = `main ${THE_WALL_BOX}`

/**
 * Whether this document may be the wall, asked before there is a document to ask.
 *
 * The root element and its attributes are the first thing a parser produces, so
 * this is answerable at `document_start` — which is the only moment early enough
 * to hold their page back without a frame of it on the screen. It is a guess
 * because the class covers every auth page they serve, and {@link wallIn} is what
 * settles it a few hundred milliseconds later.
 */
export const mayBeTheWall = (page: Document): boolean =>
  page.documentElement.classList.contains(AUTH_CLASS)

/**
 * Their wall out of the page the reader landed on, or nothing where this is some
 * other page of theirs.
 *
 * Read off the live document rather than fetched, because the wall is served in
 * place of the page that was asked for and under that page's own address. There
 * is no address to route by: `github.com/octo-org/octo-repo/pull/7` is the wall
 * one minute and the pull request the next, and the only difference is in the
 * markup.
 *
 * The token is the part worth stating plainly, because this file said the
 * opposite for a year. Their form carries `authenticity_token` as a hidden field
 * of the served page, and a content script on that page can read it like any
 * other node — so their Continue button is a form this can post, and the reader
 * does not have to press it.
 */
export const wallIn = (page: Document): Option.Option<Wall> => {
  if (!mayBeTheWall(page) || page.querySelector(THE_WALL) === null) return Option.none()

  const form = page.querySelector(`${THE_WALL} form[action*="/saml/initiate"]`)
  if (!(form instanceof HTMLFormElement)) return Option.none()

  const action = form.getAttribute("action") ?? ""

  /*
   * Their origin and no other, before anything is read out of this form.
   *
   * The selector and the pattern below both match anywhere in the string, so
   * `https://evil.example/orgs/octo-org/saml/initiate` satisfies them — and what
   * is posted to that address is their cross-site token, without a press where the
   * reader has asked for that. This is depth rather than a hole: writing that form
   * into the page needs an injection on a page of github.com, and anything that can
   * do that can read the token itself. It is still two lines on the one form here
   * that submits itself.
   */
  if (asAddress(action)?.origin !== THEIRS) return Option.none()

  const found = INITIATE.exec(action)
  const organisation = found === null ? undefined : found[1]
  if (organisation === undefined || organisation === "") return Option.none()

  /*
   * Hidden fields, which is what their form is made of. Written as the selector
   * rather than filtered afterwards, because `theirFormAgain` re-emits every one of
   * these as hidden: a visible control of theirs — a tick box, a chosen account —
   * would then be posted at whatever value it happened to load with, by a request
   * nobody made.
   */
  const fields = [...form.querySelectorAll('input[type="hidden"][name]')]
    .filter((input): input is HTMLInputElement => input instanceof HTMLInputElement)
    .map((input) => [input.name, input.value] as const)

  // Their cross-site token, which is the field the request is refused without.
  // A wall missing it is a wall this cannot answer, so their own button is left
  // where it is and nothing is said about it.
  if (!fields.some(([name, value]) => name === "authenticity_token" && value !== "")) {
    return Option.none()
  }

  return Option.some({ organisation, action, fields, backTo: backToIn(action) })
}

/**
 * Their form, built again in the page and ready to be posted.
 *
 * Built rather than borrowed, though theirs is still on the page behind the card.
 * Theirs is hidden by the takeover and may be replaced by anything their scripts
 * decide to do next; this one is ours, and what it sends is written down in
 * {@link Wall} where it can be read. It carries their fields verbatim, so the
 * request is the one their own Continue button makes.
 *
 * In the page, because a form that is not in a document cannot be posted, and
 * handed back rather than posted here: who posts it is the caller's decision, and
 * it is the whole of the decision this feature is about. It also leaves what this
 * builds assertable without a test having to navigate anywhere.
 */
export const theirFormAgain = (page: Document, wall: Wall): HTMLFormElement => {
  const form = page.createElement("form")
  form.method = "post"
  form.action = wall.action
  // Out of the way of the card, which is on the screen until this posts.
  form.hidden = true

  for (const [name, value] of wall.fields) {
    const field = page.createElement("input")
    field.type = "hidden"
    field.name = name
    field.value = value
    form.append(field)
  }

  page.body.append(form)
  return form
}

/**
 * One of their addresses, read as an address.
 *
 * Lifted rather than trusted because both callers are handed a string GitHub
 * wrote, and a `URL` that will not parse throws. Relative to their own origin, so
 * a `return_to` written as `/octo-org/octo-repo` reads the same as one written
 * whole.
 */
const asAddress = UndefinedOr.liftThrowable((address: string) => new URL(address, THEIRS))

/**
 * Where their form says the reader was going, out of its own query.
 *
 * Their address, not one built here: `return_to` is what GitHub will honour after
 * the provider answers, and a card that named anything else would be describing a
 * journey the reader is not on. Empty where they left it out, which the card
 * reads as "back where you were".
 */
const backToIn = (action: string): string =>
  asAddress(action)?.searchParams.get("return_to") ?? ""

/**
 * The path of one of their addresses, for a card that has to name it in a
 * sentence.
 *
 * Here rather than in the card because it is the same parsing the line above
 * does, on the same string, and two answers to that would be two places for it to
 * go wrong. Empty where there is nothing to name.
 */
export const pathIn = (address: string): string =>
  address === "" ? "" : (asAddress(address)?.pathname ?? "")

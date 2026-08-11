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
 */

import { Option } from "effect"

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

/** How their sign-on page marks itself, checked before the page is scanned. */
const WALLED = 'class="html-auth"'

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
 * The form on their interstitial posts with a token this cannot have, so the
 * card sends the reader to the page that carries the form rather than trying to
 * submit it. Measured: `GET /orgs/octo-org/sso?return_to=…` answers
 * 200 with that page.
 */
export const signOnPage = (organisation: string, backTo: string): string =>
  `https://github.com/orgs/${organisation}/sso?return_to=${encodeURIComponent(backTo)}`

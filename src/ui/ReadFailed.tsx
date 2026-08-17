/**
 * What a list shows when GitHub would not answer for it.
 *
 * Shared by the two lists because the distinctions that matter are the same on both,
 * and none of them is the obvious one. Every route answers as if there is nothing
 * there to a signed-out reader, which looks exactly like a payload that changed
 * shape. An organisation wanting single sign-on refuses in a third way again, and
 * that one the reader can walk through. A fourth is GitHub itself being down, which
 * is nobody's fault and fixes itself. Blaming GitHub for the first, or this
 * extension for the last, sends the reader looking for a bug in the wrong place, so
 * all four are told apart and worded differently.
 */
import { Option } from "effect"
import { signOnPage } from "../github/signOn"
import { askedToSignOn, gitHubIsDown } from "../ports/GitHubGateway"

export type ReadFailedProps = {
  /**
   * Whether GitHub has anyone signed in.
   *
   * The one of the four this card cannot read off the failure, because a route
   * answering as if there is nothing there answers 200 and looks like an empty list.
   */
  readonly signedOut: boolean
  /** What could not be read, as the reader would name it. */
  readonly what: string
  /**
   * The failure, which is where the third case is written.
   *
   * Carried rather than printed: nothing here shows it to anybody, and the one
   * thing it is asked is whether an organisation is waiting to be signed on to.
   */
  readonly why?: unknown
  /** Restores GitHub's own page, which is still there behind this. */
  readonly onStepAside: () => void
  readonly asideLabel: string
}

export const ReadFailed = ({ signedOut, what, why, onStepAside, asideLabel }: ReadFailedProps) => {
  const organisation = askedToSignOn(why)

  if (Option.isSome(organisation)) {
    return (
      <div className="Box p-4">
        <h2 className="mb-1 text-base font-semibold">
          {organisation.value} wants a single sign-on
        </h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          {`GitHub will not serve ${what} until you sign on to ${organisation.value}. Nothing is wrong here, and this page reads normally once you have.`}
        </p>
        {/* Their own page for it, rather than the form on it: that one posts with a
            token this cannot have. */}
        <a
          className="btn btn-sm btn-primary mr-2"
          href={signOnPage(organisation.value, location.href)}
        >
          Sign on to {organisation.value}
        </a>
        <button type="button" className="btn btn-sm" onClick={onStepAside}>
          {asideLabel}
        </button>
      </div>
    )
  }

  // Before the signed-out case, because a reader who is signed out is told to sign in
  // and their session is not what is wrong: the same status arrives to everybody
  // during an incident, and sending them round a login they already passed is the
  // one piece of advice guaranteed to waste their afternoon.
  if (gitHubIsDown(why)) {
    return (
      <div className="Box p-4">
        <h2 className="mb-1 text-base font-semibold">GitHub is having trouble</h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          {`GitHub answered with an error rather than with ${what}, and it was asked three times. Nothing here is broken and nothing needs doing. Their status page says whether they know, and opening this again in a minute is worth a try.`}
        </p>
        <a
          className="btn btn-sm mr-2"
          href="https://www.githubstatus.com"
          target="_blank"
          rel="noreferrer"
        >
          GitHub status
        </a>
        <button type="button" className="btn btn-sm" onClick={onStepAside}>
          {asideLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="Box p-4">
      <h2 className="mb-1 text-base font-semibold">
        {signedOut ? "You are signed out of GitHub" : "Something GitHub sends has changed"}
      </h2>
      <p className="mb-3 max-w-prose text-sm text-ink-muted">
        {signedOut
          ? `GitHub answers as if there are no pull requests while nobody is signed in. Sign in and open this again.`
          : `${what} could not be read, so nothing is shown rather than part of it. GitHub's own page is still here.`}
      </p>
      {signedOut ? (
        <a
          className="btn btn-sm btn-primary mr-2"
          href={`https://github.com/login?return_to=${encodeURIComponent(location.href)}`}
        >
          Sign in to GitHub
        </a>
      ) : null}
      {/* Not a link back to the same page: their page was never removed, only hidden,
          so this is a button that gives it back. */}
      <button type="button" className="btn btn-sm" onClick={onStepAside}>
        {asideLabel}
      </button>
    </div>
  )
}

/** Kept exported from here because every failure screen already imports it. */
export { viewerOnPage } from "./viewer"

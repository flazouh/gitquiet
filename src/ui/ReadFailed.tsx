/**
 * What a list shows when GitHub would not answer for it.
 *
 * Shared by every screen that reads GitHub, because the distinctions that matter are
 * the same on all of them and none of them is the obvious one. Every route answers as
 * if there is nothing there to a signed-out reader, which looks exactly like a payload
 * that changed shape. An organisation wanting single sign-on refuses in a third way
 * again, and that one the reader can walk through. GitHub itself being down is a
 * fourth, and a request that never reached them a fifth: neither is anybody's fault
 * and only one of them is GitHub's to fix.
 *
 * Saying the wrong one of the five sends the reader after a bug that is not there, so
 * each is told apart and worded to say who broke and what to do about it. The default
 * says a payload changed, which is the only one of the five that somebody here has to
 * go and fix, so a case nobody has thought of lands on the alarm rather than under it.
 */
import { Option } from "effect"
import { signOnPage } from "../github/signOn"
import { askedToSignOn, couldNotReachGitHub, gitHubIsDown } from "../ports/GitHubGateway"
import { SignOnAsk } from "./SignOnAsk"

export type ReadFailedProps = {
  /**
   * Whether GitHub has anyone signed in.
   *
   * The one of the five this card cannot read off the failure, because a route
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
  /**
   * What GitHub answers as, to a reader with no session.
   *
   * The one sentence here that cannot be built from {@link what}: a list is
   * answered as if it were empty and one pull request is answered as if it were not
   * there, and both read as a payload that changed shape. The frame around it is the
   * same on every screen and stays here.
   */
  readonly asIf?: string
  /** What GitHub's own thing behind this is called, which a conversation is not. */
  readonly theirs?: string
  /** Restores GitHub's own page, which is still there behind this. */
  readonly onStepAside: () => void
  readonly asideLabel: string
}

export const ReadFailed = ({
  signedOut,
  what,
  why,
  asIf = "there are no pull requests",
  theirs = "page",
  onStepAside,
  asideLabel
}: ReadFailedProps) => {
  const organisation = askedToSignOn(why)

  if (Option.isSome(organisation)) {
    return (
      <div className="Box p-4">
        <SignOnAsk
          organisation={organisation.value}
          what={what}
          then="Nothing is wrong here, and this page reads normally once you have."
        >
          {/* Their own page for it, rather than the form on it: that one posts with
              a token this cannot have, because this card is not on that page. */}
          <a
            className="btn btn-sm btn-primary mr-2"
            href={signOnPage(organisation.value, location.href)}
          >
            Sign on to {organisation.value}
          </a>
          <button type="button" className="btn btn-sm" onClick={onStepAside}>
            {asideLabel}
          </button>
        </SignOnAsk>
      </div>
    )
  }

  // Both of the next two come before the signed-out case, because a reader who is
  // signed out is told to sign in and their session is not what is wrong: neither a
  // request that never left nor an error from GitHub has anything to do with who is
  // signed in, and sending somebody round a login they already passed is the one
  // piece of advice guaranteed to waste their afternoon.
  if (couldNotReachGitHub(why)) {
    return (
      <div className="Box p-4">
        <h2 className="mb-1 text-base font-semibold">Nothing reached GitHub</h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          {`The request for ${what.toLowerCase()} never arrived, three times running, so there is nothing to say about what GitHub thinks. The connection, a proxy or something else on this machine is in the way. GitHub itself may be perfectly well.`}
        </p>
        <button type="button" className="btn btn-sm" onClick={onStepAside}>
          {asideLabel}
        </button>
      </div>
    )
  }

  if (gitHubIsDown(why)) {
    return (
      <div className="Box p-4">
        <h2 className="mb-1 text-base font-semibold">GitHub is having trouble</h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          {`${what} could not be read: GitHub answered with an error, three times running. Nothing here is broken and nothing needs doing. Their status page says whether they know about it, and opening this again in a minute is worth a try.`}
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
          ? `GitHub answers as if ${asIf} while nobody is signed in. Sign in and open it again.`
          : `${what} could not be read, so nothing is shown rather than part of it. GitHub's own ${theirs} is still here.`}
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

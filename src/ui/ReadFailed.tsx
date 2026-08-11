/**
 * What a list shows when GitHub would not answer for it.
 *
 * Shared by the two lists because the distinctions that matter are the same on both,
 * and neither is the obvious one. Every route answers as if there is nothing there to
 * a signed-out reader, which looks exactly like a payload that changed shape. An
 * organisation wanting single sign-on refuses in a third way again, and that one the
 * reader can walk through. Blaming GitHub for either sends them looking for a bug in
 * the wrong place, so all three are told apart and worded differently.
 */
import { Option } from "effect"
import { signOnPage } from "../github/signOn"
import { askedToSignOn } from "../ports/GitHubGateway"

export type ReadFailedProps = {
  /** Whether GitHub has anyone signed in, which decides which of the three this is. */
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

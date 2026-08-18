/**
 * How an organisation's single sign-on is put to a reader, wherever it is put.
 *
 * There are two places, and they are two components for a real reason: one is a
 * card inside our own working interface reporting a 401 from their API, which has
 * no token and nothing to post, so it can only send the reader to GitHub's own
 * page for it. The other stands on the wall itself, where their form and its token
 * are in the document and the button really does answer it.
 *
 * Different things to offer, then, but one thing to say — and the sentence was
 * written out three times, drifting in the tail each time. The words live here and
 * the offer arrives as children, so what actually differs between the two is what
 * you see at each call site: one passes a link, the other a button and a tick.
 */
export type SignOnAskProps = {
  readonly organisation: string
  /** What is being kept from the reader, named as their page names it. */
  readonly what: string
  /** How the sentence ends, which is the one part that is not shared. */
  readonly then: string
  readonly children: React.ReactNode
}

export const SignOnAsk = ({ organisation, what, then, children }: SignOnAskProps) => (
  <>
    <h2 className="mb-1 text-base font-semibold">{organisation} wants a single sign-on</h2>
    <p className="mb-3 max-w-prose text-sm text-ink-muted">
      {`GitHub will not serve ${what} until you sign on to ${organisation}. ${then}`}
    </p>
    {children}
  </>
)

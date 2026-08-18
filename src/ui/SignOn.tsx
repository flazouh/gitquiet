/**
 * What stands where an organisation's single sign-on wall was.
 *
 * The wall is one heading and one button, and the button does one thing: post a
 * form that is already in the page. So this card is not a richer version of their
 * page — there is nothing richer to say — it is the same button with the two
 * things their page leaves out. Which page you were going to, and an offer to stop
 * asking.
 *
 * The offer is the whole reason this exists. A reader whose organisation expires
 * its session daily presses Continue every morning, and that press carries no
 * decision: their provider is what authenticates them, and it still will. See
 * `SIGN_ON_KNOBS` in `src/domain/Settings.ts`, where the same thing is written from
 * the setting's side.
 */
import { pathIn, type Wall } from "../github/signOn"

export type SignOnProps = {
  readonly wall: Wall
  /** What the reader has asked for, which the tick here changes. */
  readonly chosen: "ask" | "always"
  readonly onChoose: (next: "ask" | "always") => void
  /**
   * Whether this wall would have been answered by itself, and was not.
   *
   * Only ever true for a reader who asked for it, and it means this organisation
   * was answered here seconds ago and the wall is up again. Saying so is the
   * difference between a setting that looks broken and a setting that is working
   * and has something to report.
   */
  readonly cameRound: boolean
  readonly onContinue: () => void
  /** Restores GitHub's own wall, which is still there behind this. */
  readonly onStepAside: () => void
}

export const SignOn = ({
  wall,
  chosen,
  onChoose,
  cameRound,
  onContinue,
  onStepAside
}: SignOnProps) => {
  /*
   * Where the reader was going, cut to the path. Their own `return_to`, but a
   * query string of forty characters in the middle of a sentence reads as noise
   * rather than as a destination — and the sentence below is written to be true
   * with it or without it.
   */
  const going = pathIn(wall.backTo)

  return (
    <div className="mx-auto max-w-prose p-6">
      <div className="Box p-4">
        <h2 className="mb-1 text-base font-semibold">
          {wall.organisation} wants a single sign-on
        </h2>
        <p className="mb-3 text-sm text-ink-muted">
          {going === ""
            ? `GitHub will not serve this page until you sign on to ${wall.organisation}. Continuing hands you to their identity provider and brings you back.`
            : `GitHub will not serve ${going} until you sign on to ${wall.organisation}. Continuing hands you to their identity provider and brings you back here.`}
        </p>

        {/* Only where it happened. A reader who never switched this on is being told
            about a mechanism they have not met, and the sentence would read as an
            error rather than as a note. */}
        {/* What it says is what this knows: the same organisation was answered here a
            moment ago and the wall is up again. Why is their provider's business, and
            "wants to see you" is the likely reason rather than a reported one. */}
        {cameRound ? (
          <p className="mb-3 text-sm text-ink-muted">
            {`This was answered for you a moment ago and ${wall.organisation} is asking again, so it is being left to you rather than posted a second time. Usually that means their identity provider wants to see you rather than the session.`}
          </p>
        ) : null}

        <div className="mb-3 flex items-center gap-2">
          <button type="button" className="btn btn-sm btn-primary" onClick={onContinue}>
            Continue to {wall.organisation}
          </button>
          {/* Their wall was hidden rather than removed, so this is a button that gives
              it back and never a link to the same address. */}
          <button type="button" className="btn btn-sm" onClick={onStepAside}>
            Show GitHub's page
          </button>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={chosen === "always"}
            onChange={(event) => onChoose(event.target.checked ? "always" : "ask")}
          />
          <span>
            Do this without asking. Your identity provider still decides: if it wants a
            password or a second factor, its own screen appears and this cannot skip it.
          </span>
        </label>
      </div>
    </div>
  )
}

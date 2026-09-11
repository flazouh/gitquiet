/**
 * A poll on a discussion, with its results always shown.
 *
 * Their own page hides the numbers behind a "Show Results" press, and a poll's answer is the
 * point of it. Its own file for the same reason the presses beside it have one: a poll is a whole
 * small screen, with its own bars and its own vote.
 */
import type { Poll } from "../domain/discussions"
import { Press, type Pressing } from "./DiscussionPresses"
import { Section } from "./Section"

/**
 * A Poll, as the two things a reader wants from one: what it asked, and where the votes went.
 *
 * The results are always drawn, never hidden behind their "Show Results" press. A poll with two
 * votes on it is a poll whose answer is the point, and a reader who has not voted is not owed
 * less of it than one who has.
 *
 * Their percentage and their count, both taken as printed. They round, they round their way, and
 * a second arithmetic here would disagree with the page the reader just came from.
 */
export const Voting = ({ poll, onPress }: { readonly poll: Poll; readonly onPress?: Pressing }) => (
  <Section
    name={poll.question}
    art="comments"
    summary={
      <span className="tabular-nums text-xs text-ink-muted">
        {poll.votes === 1 ? "1 vote" : `${poll.votes} votes`}
      </span>
    }
  >
    <ul className="list-none px-3 py-2">
      {poll.options.map((option) => (
        <li key={option.id} className="py-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span className={option.chosen ? "font-semibold text-ink" : "text-ink"}>
              {option.name}
            </span>
            {option.chosen ? (
              <span className="text-xs text-done">Yours</span>
            ) : null}
            <span className="ml-auto tabular-nums text-xs text-ink-muted">{`${option.share}%`}</span>
            {poll.mayVote ? (
              <Press
                said={`Vote for ${option.name}`}
                onPress={onPress}
                press={{ kind: "vote", option: option.id }}
              >
                Vote
              </Press>
            ) : null}
          </div>
          {/* Their own bar, at their own width. A bar is what makes two numbers a shape. */}
          <div className="mt-1 h-1 w-full rounded bg-hover">
            <div className="h-1 rounded bg-busy" style={{ width: `${option.share}%` }} />
          </div>
        </li>
      ))}
    </ul>
    {poll.locked ? (
      <p className="px-3 pb-2 text-xs text-ink-muted">This poll is closed.</p>
    ) : null}
  </Section>
)

import { Option } from "effect"
import type { Notice, Press, PressKind, Standing } from "../domain/notices"
import { docketsOf, pressOf } from "../domain/notices"
import { type ArtName, useArt } from "./art"
import { COURT_ART, COURT_NAME, COURT_TONE } from "./courts"
import { ASIDE, GHOST } from "./dress"
import { Face } from "./Face"
import { STATE_INK } from "./Icon"
import { Section } from "./Section"
import { ageOf, momentOf } from "./when"

/**
 * Why the reader was told, said in words rather than in GitHub's string.
 *
 * Their own visible label is the machine string humanised one word at a time — `assign` reads
 * "assigned", `state_change` reads "state change" — which says what happened to the thread and
 * not what it has to do with the reader. These are the second thing, because that is the
 * question the Court the row is in has already half answered: a reader who sees "Review asked
 * of you" under Needs You has read one sentence rather than two words.
 *
 * All fifteen, and the fall-through is deliberately vague. A reason nobody here has seen goes
 * to Waiting and should say as little as the row really knows.
 */
const SAID: Readonly<Record<string, string>> = {
  review_requested: "Review asked of you",
  approval_requested: "Your approval holds it up",
  assign: "Assigned to you",
  mention: "You were named",
  security_alert: "A vulnerability in your repository",
  member_feature_requested: "Members are waiting on an administrator",
  author: "You opened it",
  comment: "You spoke in it",
  manual: "You subscribed to it",
  subscribed: "You watch the repository",
  team_mention: "Your team was named",
  ci_activity: "A run you triggered finished",
  invitation: "You were invited",
  security_advisory_credit: "You were credited",
  state_change: "It was opened or closed"
}

/**
 * The glyph at the head of a row, which is the shape GitHub drew there.
 *
 * The same four names the rest of this interface uses for the same four facts, so a merged pull
 * request in the inbox is the shape it is on the list and on its own page. A subject whose
 * state the parser could not read gets the inbox's own glyph rather than a guess: `unknown` is
 * a real answer on this page — an advisory has no state, and a discussion's shape is unread —
 * and drawing an open pull request over one would be the row claiming something.
 */
const ART_OF: Record<Standing, ArtName> = {
  open: "pull-request",
  merged: "pull-request-merged",
  closed: "pull-request-closed",
  unknown: "notifications"
}

/**
 * What the glyph is worth saying out loud, for a reader who is being read to.
 *
 * The state and not the shape, because the shape is only how it is drawn. A row whose state
 * could not be read says nothing at all rather than "unknown", which would be this interface
 * reading out its own uncertainty on every advisory.
 */
const SPOKEN: Record<Standing, string> = {
  open: "Open",
  merged: "Merged",
  closed: "Closed",
  unknown: ""
}

/**
 * The colour the glyph is drawn in, borrowed from a pull request in a line of text.
 *
 * Borrowed rather than chosen, so that a merged thing is the same purple here as it is in a
 * Working Set row and on the card at the top of a pull request. See `STATE_INK`.
 */
const TONE_OF: Record<Standing, string> = {
  open: STATE_INK.open,
  merged: STATE_INK.merged,
  closed: STATE_INK.closed,
  unknown: "text-ink-muted"
}

/**
 * The presses drawn on a row, in the order a reader reaches for them.
 *
 * Done first because it is the one that empties an inbox, and this is the whole reason the
 * presses are here rather than on their page: a reader who can see that 41 rows of 51 are
 * finished should be able to say so without opening any of them.
 *
 * `star` and `unstar` are parsed and never drawn. Nothing on the row says whether a Notice is
 * already saved, so which half of that pair applies cannot be known — see the spec.
 */
const OFFERED: ReadonlyArray<{ readonly kind: PressKind; readonly said: string; readonly art: ArtName }> = [
  { kind: "archive", said: "Done", art: "tick" },
  { kind: "mark", said: "Mark read", art: "eye" },
  { kind: "unmark", said: "Mark unread", art: "dot" },
  { kind: "unsubscribe", said: "Unsubscribe", art: "close" },
  { kind: "subscribe", said: "Subscribe", art: "eye" }
]

/** One press, where the row's own state says it applies. */
const Doing = ({
  notice,
  kind,
  said,
  art,
  onPress
}: {
  readonly notice: Notice
  readonly kind: PressKind
  readonly said: string
  readonly art: ArtName
  readonly onPress: (press: Press) => void
}) => {
  const set = useArt()
  const Glyph = set[art]
  const press = pressOf(notice, kind)
  if (Option.isNone(press)) return null

  return (
    <button
      type="button"
      // Its name in a tooltip as well as in the label, because the button is a glyph: the row
      // holds four of these and four words on it would be a toolbar over a title.
      title={said}
      aria-label={said}
      className={`${GHOST} grid size-6 shrink-0 place-items-center text-ink-muted hover:bg-active hover:text-ink`}
      onClick={() => onPress(press.value)}
    >
      <Glyph size={14} aria-hidden="true" />
    </button>
  )
}

/**
 * Who has been in the thread lately, machines marked.
 *
 * Marked and not separated, which is the honest version of what the row says: the stack names
 * recent participants rather than whoever opened the subject, so a machine here means a machine
 * has been in the thread and nothing more. See the spec on
 * [#4520](https://github.com/orgs/community/discussions/4520).
 */
const Who = ({ notice }: { readonly notice: Notice }) => {
  const set = useArt()
  const Bot = set["bot"]

  return (
    <span className="flex shrink-0 items-center gap-1">
      {notice.participants.slice(0, 4).map((one) => (
        <span
          key={one.login}
          className="flex items-center"
          title={one.isAutomated ? `${one.login}, a machine` : one.login}
        >
          {one.isAutomated ? (
            <Bot size={14} aria-hidden="true" className="text-ink-muted" />
          ) : (
            <Face faceUrl={one.faceUrl} name={one.login} />
          )}
        </span>
      ))}
    </span>
  )
}

/**
 * One Notice: what it is about, why it reached the reader, and what they can do about it.
 *
 * The title is the link and the row is not, unlike GitHub's, whose whole row is one anchor with
 * their buttons inside it. That shape is why their own presses need a script to stop the
 * navigation, and it means a reader cannot select a title without opening the thread.
 */
const Row = ({
  notice,
  onPress
}: {
  readonly notice: Notice
  readonly onPress: (press: Press) => void
}) => {
  const set = useArt()
  const Mark = set[ART_OF[notice.standing]]
  const age = ageOf(notice.movedAt)
  const spoken = SPOKEN[notice.standing]

  return (
    <li className="flex items-start gap-2.5 px-3 py-2 hover:bg-hover">
      <span
        aria-label={spoken === "" ? undefined : spoken}
        className={`mt-0.5 shrink-0 ${TONE_OF[notice.standing]}`}
      >
        <Mark size={16} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {/* Heavier while it is unread, which is the whole of what read state does to a row:
              it orders and weights, and never moves a Notice between Courts. */}
          <a
            className={`min-w-0 flex-1 truncate text-sm text-ink no-underline hover:underline ${
              notice.unread ? "font-semibold" : ""
            }`}
            href={notice.url}
          >
            {notice.title}
          </a>

          {notice.number === null ? null : (
            <span className="shrink-0 text-sm tabular-nums text-ink-muted">{`#${notice.number}`}</span>
          )}

          {age === "" ? null : (
            <span className="shrink-0 text-xs text-ink-muted" title={momentOf(notice.movedAt)}>
              {age}
            </span>
          )}
        </div>

        <div className={`mt-0.5 flex items-center gap-2 ${ASIDE}`}>
          <span className="min-w-0 truncate">{notice.repository}</span>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate">{SAID[notice.reason] ?? "It moved"}</span>
          <Who notice={notice} />
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-0.5">
        {OFFERED.map((one) => (
          <Doing
            key={one.kind}
            notice={notice}
            kind={one.kind}
            said={one.said}
            art={one.art}
            onPress={onPress}
          />
        ))}
      </span>
    </li>
  )
}

/**
 * The reader's inbox in three Courts.
 *
 * Grouped and never filtered. Their own pane offers `is:unread` and `reason:mention` and cannot
 * offer `is:open` at all — it answers zero rows for it — so the question every one of the five
 * recorded threads asks is one their controls cannot put. Filing by who acts next puts it
 * without asking the reader to write anything: on the inbox this was measured against, 41 rows
 * of 51 were about work already finished, and they are one Court the reader can leave shut.
 *
 * Three of the product's four, and the missing one is Running. Every Court a screen draws is
 * drawn whether or not it has rows today, because a reader finds Settled by where it sits and a
 * heading that came and went would take that away — which is the argument this comment used to
 * make for keeping Running as well. It does not hold for a Court no row can ever reach: Running
 * means a machine owes the next step, a Notice is sent because a machine has finished, and
 * `courtOf` therefore never returns it. What a permanently empty heading teaches the reader is
 * that a heading may mean nothing, which is the opposite of what the four Courts are for. So
 * the inbox has three, every other screen still has four, and "Nothing." is kept for a Court
 * that is empty this morning and full this afternoon.
 */
export const Notices = ({
  notices,
  onPress
}: {
  readonly notices: ReadonlyArray<Notice>
  readonly onPress: (press: Press) => void
}) => {
  const dockets = docketsOf(notices)

  if (notices.length === 0) {
    return <p className="px-3 py-2 text-sm text-ink-muted">Nothing is in your inbox.</p>
  }

  return (
    <>
      {dockets.map((docket) => (
        <Section
          key={docket.court}
          name={COURT_NAME[docket.court]}
          tone={COURT_TONE[docket.court]}
          art={COURT_ART[docket.court]}
          summary={<span className="tabular-nums">{docket.count}</span>}
        >
          {docket.notices.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-muted">Nothing.</p>
          ) : (
            <ul className="divide-y divide-line-muted">
              {docket.notices.map((notice) => (
                <Row key={notice.id} notice={notice} onPress={onPress} />
              ))}
            </ul>
          )}
        </Section>
      ))}
    </>
  )
}

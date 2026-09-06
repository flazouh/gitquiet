import type { Effect } from "effect"
import { Option } from "effect"
import type { GistComment } from "../domain/gist"
import { Comments } from "./ThreadView"
import { Saying } from "./Saying"
import { Section } from "./Section"

/**
 * What anybody said under a gist.
 *
 * Their own page keeps this at the very bottom, under every file — so on a gist of four
 * files it is a scroll away from anything, and on a long one nobody finds it at all.
 * Here it is in the left column beside the code, which is where a pull request keeps its
 * conversation and for the same reason: the discussion and the thing being discussed are
 * read together.
 *
 * A gist has no lines to hang a thread on, so every comment is about the whole thing and
 * the panel is a flat list. That is what `Conversation` draws for an issue too, minus the
 * threads it has none of — this is that shape without the machinery for the half a gist
 * cannot have.
 */

/** How many their head counts, against how many their page actually carried. */
const saidSoFar = (said: ReadonlyArray<GistComment>, held: boolean): string => {
  if (said.length === 0) return "nothing said yet"

  const many = `${said.length} comment${said.length === 1 ? "" : "s"}`
  return held ? `${many}, and older ones not read yet` : many
}

export const GistTalk = ({
  said,
  earlier,
  viewer,
  keep,
  reading,
  onEarlier,
  onSay
}: {
  readonly said: ReadonlyArray<GistComment>
  /** Whether their page held older comments back, which is what the way to them is drawn for. */
  readonly earlier: boolean
  /** Whoever is writing, so the box at the foot is signed as the comment will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /** What an unsent draft is kept under. See `held.ts`. */
  readonly keep?: string
  /** Whether the older ones are being fetched right now. */
  readonly reading?: boolean
  readonly onEarlier?: () => void
  /**
   * Says something under the gist. Absent where GitHub drew no box — a reader who is not
   * signed in, or an owner who turned comments off — because a box that throws when it is
   * used is worse than no box.
   */
  readonly onSay?: (body: string) => Effect.Effect<unknown, unknown>
}) => (
  <Section name="Conversation" art="comments" summary={saidSoFar(said, earlier)}>
    {/*
      Above the oldest comment, which is where their own control sits and the only place
      it means anything: what it fetches goes in above it.
    */}
    {earlier && onEarlier !== undefined ? (
      <div className="border-b border-line-muted px-3 py-2">
        <button
          type="button"
          disabled={reading}
          onClick={onEarlier}
          className="text-xs text-ink-muted hover:underline disabled:opacity-50"
        >
          {reading ? "Reading…" : "Load earlier comments"}
        </button>
      </div>
    ) : null}

    {/*
      One list rather than one call per comment. `Comments` draws an `<article>` apiece,
      which is what a flat conversation is — the rule between them is decoration, and a
      wrapper per comment to hang it on would be a list component used a row at a time.
    */}
    {/* Two levels down, because `Comments` puts its articles in a wrapper of its own. */}
    <div className="[&>div>article+article]:border-t [&>div>article+article]:border-line-muted">
      <Comments
        id={`gist-${said[0]?.id ?? "none"}`}
        comments={said.map((comment) => ({
          id: comment.id,
          author: {
            login: comment.author.login,
            isAutomated: false,
            faceUrl: Option.fromNullishOr(comment.author.faceUrl)
          },
          body: comment.body,
          html: comment.html,
          createdAt: comment.createdAt
        }))}
      />
    </div>

    {/* Last, under everything said so far, because that is the order it is read in. */}
    {onSay === undefined ? null : (
      <Saying viewer={viewer} subject="gist" keep={keep} onSay={onSay} />
    )}
  </Section>
)

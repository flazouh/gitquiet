import type { Option } from "effect"

/**
 * What GitHub will say about a Participant beyond their login.
 *
 * A face in a row answers "who" and nothing else, and the answer is often not
 * enough: a reader looking at `seawatts` wants the name they know them by, and a
 * reader looking at a login they have never seen wants to know whether this is a
 * colleague, a stranger, or somebody who has been in this repository all week.
 *
 * Every field but the login is optional because every field but the login is
 * optional on GitHub. A portrait with nothing in it is still worth drawing: the
 * login is the one thing that was always going to be there.
 */
export type Portrait = {
  readonly login: string
  /** The name they go by, where they have set one. */
  readonly name: Option.Option<string>
  readonly pronouns: Option.Option<string>
  readonly bio: Option.Option<string>
  readonly location: Option.Option<string>
  /** GitHub's own URL for their face, at the size a card wants rather than a row. */
  readonly faceUrl: Option.Option<string>
  /**
   * GitHub's one line about them, whatever it happens to be.
   *
   * Their card has exactly one slot here and what goes in it depends on what was
   * asked: with no subject it is the organisations they belong to, and asked
   * about a repository it becomes how recently they touched that repository —
   * which is the more useful of the two in a list of its pull requests.
   *
   * Kept as the sentence GitHub wrote rather than taken apart, because the slot
   * is theirs and a third kind of line would break a model of the first two.
   */
  readonly note: Option.Option<string>
  /** Whether GitHub offered a Sponsor button, which is the only way to know. */
  readonly sponsorable: boolean
  /** Whether the reader already follows them. */
  readonly followedByViewer: boolean
}

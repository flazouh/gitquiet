/**
 * What the Rail knows without asking GitHub anything.
 *
 * The Rail is the strip of navigation on every screen this extension renders, and the
 * longest list on it is the Participant's repositories. GitHub's own version of that list
 * — "Top repositories" in their home sidebar — is ranked by where a reader has been, and
 * their own readers say so: the sidebar is one of two duplicated lists they asked to have
 * removed, and the thing they wanted instead was where their work is.
 *
 * Which the Working Set already knows. Every row it draws names a repository, so this
 * list is a fold over a read that has already happened: no request, no port method, no
 * cache. See `docs/spec/home.md`, where this is the first of three reads and deliberately
 * the cheapest.
 */

import type { Piled, Sitting } from "./sittings";

/** A repository the Participant has work in, as the Rail lists it. */
export type RepositoryAtWork = {
  readonly owner: string;
  readonly repo: string;
  /** `repo` alone, which is what the Rail shows: the owner is usually the reader. */
  readonly name: string;
  /**
   * Involved Pull Requests here, counting the ones inside stacks.
   *
   * A stack of three is three things owed. Counting piles instead would be counting how
   * the Working Set is drawn, which is the same mistake a Court heading must not make.
   */
  readonly count: number;
  /** How many of those are the Participant's own move. */
  readonly yourMove: number;
};

const everyOne = (piles: ReadonlyArray<Piled>): ReadonlyArray<Piled> =>
  piles.flatMap((pile) => [pile, ...everyOne(pile.above)]);

/**
 * The repositories the Working Set is spread across, the ones asking something first.
 *
 * Ranked by the reader's own turn, then by how much is there, then by name. Never by when
 * anything last changed: that is the rule that puts a 2016 pull request at the top of
 * GitHub's version, and a repository whose four pull requests are all waiting on other
 * people is asking the reader for nothing at all.
 *
 * The name is stable under a re-read, which matters more than it sounds: this list is
 * navigation, and navigation that reorders itself while somebody is reaching for it is
 * worse than navigation in the wrong order.
 */
export const repositoriesAtWork = (
  sittings: ReadonlyArray<Sitting>,
): ReadonlyArray<RepositoryAtWork> => {
  const found = new Map<
    string,
    { owner: string; repo: string; count: number; yourMove: number }
  >();

  for (const sitting of sittings) {
    for (const pile of everyOne(sitting.piles)) {
      const { owner, repo } = pile.one.reference;
      const key = `${owner}/${repo}`;
      const already = found.get(key) ?? { owner, repo, count: 0, yourMove: 0 };

      found.set(key, {
        ...already,
        count: already.count + 1,
        // The pile member's own Court rather than the Court it is filed under: nothing
        // above a foundation is the reader's move until the foundation has landed.
        yourMove: already.yourMove + (pile.court === "your-move" ? 1 : 0),
      });
    }
  }

  return [...found.values()]
    .map((one) => ({ ...one, name: one.repo }))
    .sort(
      (left, right) =>
        right.yourMove - left.yourMove ||
        right.count - left.count ||
        left.name.localeCompare(right.name),
    );
};

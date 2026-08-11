import { describe, expect, test } from "bun:test";
import { Option } from "effect";
import { sittingsIn } from "./sittings";
import type { InvolvedPullRequest, Shelf } from "./workingSet";
import { repositoriesAtWork } from "./rail";

const involved = (
  number: number,
  repo: string,
  shelf: Shelf,
  over: Partial<InvolvedPullRequest> = {},
): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo, number },
  id: number * 1000,
  title: `pull request ${number}`,
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some(shelf),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: `sha${number}`,
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none(),
  ...over,
});

const asRead = (rows: ReadonlyArray<InvolvedPullRequest>) =>
  sittingsIn(rows, () => Option.none());

/**
 * The Rail's first list of repositories, which costs nothing to produce.
 *
 * Every row the shelves already return names a repository, so the list of repositories a
 * Participant is working in falls out of the read the Working Set has already made — no
 * new request, no new port method, and it is the list GitHub cannot produce: theirs is
 * ranked by where you have been rather than by where your work is.
 *
 * Its limitation is stated here rather than hidden: a repository with no Involved Pull
 * Request is not in it, and cannot be until a real repository read exists.
 */
describe("the repositories a Participant is at work in", () => {
  test("is one entry per repository, however many pull requests are in it", () => {
    const found = repositoriesAtWork(
      asRead([
        involved(1, "octo-repo", "needs-action"),
        involved(2, "octo-repo", "waiting-for-review"),
        involved(3, "gitquiet", "needs-action"),
      ]),
    );

    expect(found.map((one) => one.name)).toEqual(["octo-repo", "gitquiet"]);
  });

  test("says how much work is in each, and how much of it is the reader's own move", () => {
    const found = repositoriesAtWork(
      asRead([
        involved(1, "octo-repo", "needs-action"),
        involved(2, "octo-repo", "waiting-for-review"),
        involved(3, "octo-repo", "waiting-for-review"),
      ]),
    );

    expect(found[0]).toMatchObject({
      owner: "flazouh",
      repo: "octo-repo",
      count: 3,
      yourMove: 1,
    });
  });

  test("puts the repository asking something of the reader first", () => {
    // Not the busiest repository, and deliberately not the most recently touched: the
    // question this list answers is where the reader's turn is, and a repository with
    // four pull requests waiting on other people is asking for nothing.
    const found = repositoriesAtWork(
      asRead([
        involved(1, "quiet", "waiting-for-review"),
        involved(2, "quiet", "waiting-for-review"),
        involved(3, "quiet", "waiting-for-review"),
        involved(4, "loud", "needs-action"),
      ]),
    );

    expect(found.map((one) => one.name)).toEqual(["loud", "quiet"]);
  });

  test("then the one with more work in it, and then alphabetically", () => {
    const found = repositoriesAtWork(
      asRead([
        involved(1, "beta", "waiting-for-review"),
        involved(2, "alpha", "waiting-for-review"),
        involved(3, "busy", "waiting-for-review"),
        involved(4, "busy", "waiting-for-review"),
      ]),
    );

    expect(found.map((one) => one.name)).toEqual(["busy", "alpha", "beta"]);
  });

  test("counts the pull requests inside a stack rather than the stack", () => {
    // A stack of three is three things owed. A count that read 1 would be counting how
    // the list is drawn, which is the same mistake a Court heading must not make.
    const rows = [
      involved(1, "octo-repo", "needs-action", { headSha: "one" }),
      involved(2, "octo-repo", "needs-action", { headSha: "two" }),
      involved(3, "octo-repo", "needs-action", { headSha: "three" }),
    ];
    const stacked = sittingsIn(rows, (one) =>
      Option.some(
        one.reference.number === 1
          ? { headBranch: "one", baseBranch: "main" }
          : one.reference.number === 2
            ? { headBranch: "two", baseBranch: "one" }
            : { headBranch: "three", baseBranch: "two" },
      ),
    );

    const found = repositoriesAtWork(stacked);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "octo-repo", count: 3, yourMove: 3 });
  });

  test("is empty when nothing has been read, rather than absent", () => {
    expect(repositoriesAtWork([])).toEqual([]);
  });
});

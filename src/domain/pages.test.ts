import { describe, expect, test } from "bun:test";
import { isDashboard, isHome, showsWorkingSet, THE_HOME } from "./pages";

/**
 * The two addresses that draw the same list, asked together.
 *
 * One screen stands on both: the Working Set is what home shows by default, and the
 * list itself is read from GitHub rather than from the path, so `/pulls` and `/` differ
 * in which of GitHub's regions it is drawn into and in nothing else. This is the
 * predicate that has to agree with the places, and both are worth pinning here because
 * the screen and the shell each ask it separately.
 */
describe("where the Working Set is drawn", () => {
  test("their pull request dashboard, at any of its addresses", () => {
    expect(showsWorkingSet("/pulls")).toBe(true);
    expect(showsWorkingSet("/pulls/inbox")).toBe(true);
    expect(showsWorkingSet("/pulls/review-requested")).toBe(true);
  });

  test("and home, which shows it first of the three", () => {
    expect(showsWorkingSet("/")).toBe(true);
    expect(showsWorkingSet("/dashboard")).toBe(true);
  });

  test("and nowhere the two patterns do not already claim", () => {
    // The whole value of one predicate over two: a page added to either one is a page
    // this agrees about, and there is no third list of addresses to fall behind.
    expect(showsWorkingSet("/feed")).toBe(false);
    expect(showsWorkingSet("/dashboards")).toBe(false);
    expect(showsWorkingSet("/flazouh/githubpro/pulls")).toBe(false);
    expect(showsWorkingSet("/notifications")).toBe(false);
  });
});

/**
 * The page a session starts on, and the one address on GitHub where being wrong
 * about it is expensive: every soft navigation on the site passes through here, so
 * a pattern that matches one character too many claims a page this extension has
 * nothing to say about.
 */
describe("the home dashboard's address", () => {
  test("is the root of the site", () => {
    expect(isHome("/")).toBe(true);
  });

  test("and the alias GitHub serves the same page under", () => {
    // Read off both live pages by `scripts/probe-home-dom.js`: same controller, same
    // action, same DOM to the element. Claiming one and not the other would leave a
    // reader who typed the alias on the page this replaces.
    expect(isHome("/dashboard")).toBe(true);
    expect(isHome("/dashboard/")).toBe(true);
  });

  test("is not a repository whose owner is called dashboard", () => {
    expect(isHome("/dashboard/something")).toBe(false);
    expect(isHome("/flazouh/dashboard")).toBe(false);
  });

  test("is not one character more than itself", () => {
    expect(isHome("/dashboards")).toBe(false);
  });

  test("is not the feed, which GitHub moved to a page of its own", () => {
    expect(isHome("/feed")).toBe(false);
  });

  test("is not their pull request dashboard, and it is not this", () => {
    // Two pages, two screens, and the words for them are close enough that the
    // patterns are worth pinning against each other rather than one at a time.
    expect(isHome("/pulls")).toBe(false);
    expect(isDashboard("/")).toBe(false);
    expect(isDashboard("/dashboard")).toBe(false);
  });

  test("is where a reader asking for home should be sent", () => {
    expect(isHome(THE_HOME)).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import {
  ACTIONS,
  BLAME,
  COMMIT,
  COMMITS,
  CONVERSATION,
  DASHBOARD,
  ISSUE,
  ISSUES,
  NOTIFICATIONS,
  PERSON_REPOS,
  PERSON_STARS,
  placeLoadedOn,
  placeOwning,
  PLACES,
  PROFILE,
  RAISE,
  DISCUSSION,
  DISCUSSIONS,
  RELEASES,
  REPO_HOME,
  REPO_ISSUES,
  REPO_PULLS,
  RUN,
  SIGN_ON,
  type Place,
} from "./place";

/**
 * Every page, named by the address it is reached at.
 *
 * One table, because the two things that read it have to agree: the shell routes a
 * press by which place owns the address, and `mount.ts` will not let a screen stand
 * on the page until the same rule says the address is that screen's own. Where they
 * disagreed the screen would be fetched, and then wait for an address it does not
 * recognise until the failsafe hands the page back.
 */
const ADDRESSES: ReadonlyArray<readonly [string, Place]> = [
  /*
   * A person's three, which are one path and a `tab` parameter. Written whole here
   * rather than as a path column and a search column, because that is how they are
   * read: `placeOwning` is asked with both, and the three differ in the second.
   */
  ["/flazouh", PROFILE],
  ["/flazouh?tab=overview", PROFILE],
  ["/flazouh?tab=repositories", PERSON_REPOS],
  ["/flazouh?tab=repositories&page=2&q=octo", PERSON_REPOS],
  ["/flazouh?tab=stars", PERSON_STARS],
  ["/facebook/react/pull/1749", CONVERSATION],
  ["/facebook/react/commit/9f7d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f", COMMIT],
  ["/facebook/react/commits/main", COMMITS],
  ["/pulls", DASHBOARD],
  ["/", DASHBOARD],
  ["/facebook/react/pulls", REPO_PULLS],
  ["/facebook/react/issues/42", ISSUE],
  // Before the list, and the order in `PLACES` is what makes it so: their list
  // rule reads this as the list with a filter on it, and a form that routed to
  // the list would be a list drawn over their form.
  ["/facebook/react/issues/new", RAISE],
  ["/facebook/react/issues", REPO_ISSUES],
  ["/issues", ISSUES],
  ["/facebook/react/actions/runs/30866145080", RUN],
  ["/facebook/react/actions/runs/30866145080/job/1234", RUN],
  ["/facebook/react/actions", ACTIONS],
  ["/facebook/react/releases", RELEASES],
  ["/facebook/react/discussions/70178", DISCUSSION],
  ["/facebook/react/discussions", DISCUSSIONS],
  /*
   * An organisation's, which is where GitHub runs its own product feedback. One place serves
   * both, because they are one page in two layouts.
   */
  ["/orgs/community/discussions", DISCUSSIONS],
  ["/orgs/community/discussions/categories/discussions", DISCUSSIONS],
  ["/orgs/community/discussions/88425", DISCUSSION],
  ["/facebook/react/discussions/categories/q-a", DISCUSSIONS],
  ["/facebook/react/discussions?discussions_q=is%3Aunanswered&page=2", DISCUSSIONS],
  ["/notifications", NOTIFICATIONS],
  ["/facebook/react", REPO_HOME],
  ["/facebook/react/tree/main/src", REPO_HOME],
  ["/facebook/react/blame/main/README.md", BLAME],
  // Their Files tab is the same screen as the conversation, opened on the diff.
  ["/facebook/react/pull/1749/files", CONVERSATION],
];

/** Pages of GitHub's that this extension has no screen for, and must not claim. */
const THEIRS: Array<string> = [
  // Two of the three tabs beside a pull request are GitHub's on purpose. Files is
  // the conversation's own page now — see `PULL_REQUEST_PATH` for the evidence.
  "/facebook/react/pull/1749/commits",
  "/facebook/react/pull/1749/checks",
  // The two pages under the same word as the inbox. Neither lists a Notice: one lists the
  // threads the reader is subscribed to and the other lists repositories.
  "/notifications/subscriptions",
  "/watching",
  "/facebook/react/settings",
  "/facebook/react/actions/caches",
  /*
   * One Version, the redirect to it, and their list of tags. All three are a press away from
   * the releases list, so a place that read `/releases` as a prefix would claim the page a
   * reader went to next and leave them looking at a gate over nothing.
   */
  "/facebook/react/releases/tag/v19.0.0",
  "/facebook/react/releases/latest",
  "/facebook/react/tags",
  /*
   * The form for raising a discussion, which is a press away from the list, and the page that
   * lists an organisation's own repositories. Neither is a discussion, and a place that read
   * `/discussions` as a prefix would claim both and gate a page it cannot draw.
   */
  "/facebook/react/discussions/new",
  "/orgs/community/discussions/new",
  "/orgs/community/repositories",
  // Their own stars pages, which are somebody else's list under a reserved word.
  "/stars/flazouh",
  "/stars/flazouh/lists/tools",
  // The picker that stands in front of the form where a repository has templates.
  // Which template is a question about their repository's own files, so the form
  // this extension draws is reached from it rather than instead of it.
  "/facebook/react/issues/new/choose",
  "/feed",
  /*
   * `/facebook` is deliberately absent from this list, and it used to be on it.
   *
   * An organisation's address is one segment, exactly as a person's is, and no rule
   * written against an address can tell the two apart: `facebook` is a real account
   * name. So the profile place claims it and the document settles it — measured,
   * an organisation carries no `user-profile-frame` and no profile sidebar, so no
   * gate fires and the screen hands the page back. See `PROFILE`.
   */
  // The tabs of a person's page this interface draws no screen for. Each is the
  // profile's own address with one word changed, so a place that read the path
  // alone would claim all of them.
  "/flazouh?tab=achievements",
  "/flazouh?tab=followers",
  "/flazouh?tab=following",
  "/flazouh?tab=packages",
  "/flazouh?tab=projects",
  "/flazouh?tab=sponsoring",
  // The site's own one-segment pages, which look exactly like a login.
  "/features",
  "/pricing",
  "/marketplace",
  "/orgs/facebook/repositories",
  // A branchless blame, and a branch with no path after it. GitHub does not serve
  // either, and `blameIn` refuses both rather than guessing what was meant.
  "/facebook/react/blame",
  "/facebook/react/blame/main",
];

/** A whole address as the two halves `placeOwning` is asked with. */
const owningOf = (address: string): Place | null => {
  const at = address.indexOf("?");
  return at === -1
    ? placeOwning(address)
    : placeOwning(address.slice(0, at), address.slice(at));
};


/*
 * What a place still is, now that it no longer describes GitHub's markup.
 *
 * This file used to prove the regions and bands of twenty-three places against
 * fixtures of their pages — that the pull request dashboard's two-column layout
 * was found, that the home sidebar was taken with the surface, that a deploy hash
 * changing on a class did not lose the branch banner. None of that is a question
 * any more: the interface stands on a stage of its own inside a shadow root, and
 * one rule hides everything in `body` that is not the host.
 *
 * Two things are left, and they are the two that were ever facts about a page
 * rather than about their HTML: which addresses it owns, and how a page that was
 * really served is told apart from the sign-on wall standing in for it.
 */

describe("which addresses belong to which page", () => {
  test.each(ADDRESSES)("%s is the %s", (address, place) => {
    expect(owningOf(address)?.name).toBe(place.name);
  });

  test.each(THEIRS)("%s stays GitHub's", (address: string) => {
    expect(owningOf(address)).toBeNull();
  });

  /*
   * The wall's own guard, and the reason it is written as a rule about every
   * address rather than about the table it is left out of. `SIGN_ON.owns` said
   * true everywhere once, on the grounds that the wall really is served at every
   * address, and the only thing keeping it off every press was its absence from
   * one hand-kept list. This asserts the property instead: whatever list it is in,
   * no address routes there.
   */
  test("no address routes to the wall, which is recognised in the document", () => {
    for (const address of [...ADDRESSES.map(([one]) => one), ...THEIRS]) {
      expect(owningOf(address)?.name).not.toBe(SIGN_ON.name)
    }
  })

  test("every place says how it is recognised, and answers with a real rule", () => {
    /*
     * The compiler asks for `owns` and this asks that it was answered with
     * something — a rule false everywhere is a page nothing ever routes to, and a
     * rule true everywhere is a page everything routes to. Both compile.
     *
     * `loadedWhen` is the one honest way out of it: a page with no address of its
     * own says so by refusing every address and being recognised in the document
     * instead. Answering neither is the failure this catches.
     */
    const byAddress = PLACES.filter((place) =>
      ADDRESSES.some(([address]) => {
        const at = address.indexOf("?");
        return at === -1
          ? place.owns(address)
          : place.owns(address.slice(0, at), address.slice(at));
      }),
    );
    const byDocument = PLACES.filter((place) => place.loadedWhen !== undefined);

    expect(byAddress.length + byDocument.length).toBe(PLACES.length);
    // And never both, which would be two answers to one question.
    expect(byAddress.filter((place) => byDocument.includes(place))).toHaveLength(0);
  });
});

describe("which page a loaded document is", () => {
  const ordinary = (): Document => document.implementation.createHTMLDocument("github")

  test("is the address, on every page GitHub really served", () => {
    expect(placeLoadedOn(ordinary(), "/facebook/react/pull/1749")?.name).toBe(
      CONVERSATION.name
    )
  })

  test("is the wall, where the wall was served under that same address", () => {
    const walled = ordinary()
    walled.documentElement.className = "html-auth"

    expect(placeLoadedOn(walled, "/facebook/react/pull/1749")?.name).toBe(SIGN_ON.name)
  })

  /*
   * The wall stands in front of everything an organisation owns, including pages
   * this extension has no screen for. Read by the address that would be nothing at
   * all, and the reader would be left looking at GitHub's wall with no card on it.
   */
  test("is the wall even where the address is a page nothing here claims", () => {
    const walled = ordinary()
    walled.documentElement.className = "html-auth"

    expect(placeLoadedOn(walled, "/facebook/react/settings")?.name).toBe(SIGN_ON.name)
  })

  test("keeps a person's three apart, so the search is still read", () => {
    expect(placeLoadedOn(ordinary(), "/flazouh", "?tab=repositories")?.name).toBe(
      PERSON_REPOS.name
    )
  })
})

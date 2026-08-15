import { describe, expect, test } from "bun:test";
import { findSlot, interfaceContainer, ROOT_ID, takeOverSlot } from "./mount";
import {
  ACTIONS,
  COMMIT,
  COMMITS,
  CONVERSATION,
  DASHBOARD,
  HOME,
  ISSUE,
  ISSUES,
  NOTIFICATIONS,
  PERSON_REPOS,
  PERSON_STARS,
  placeOwning,
  PLACES,
  PROFILE,
  RAISE,
  RELEASES,
  REPO_HOME,
  REPO_ISSUES,
  REPO_PULLS,
  RUN,
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
  ["/notifications", NOTIFICATIONS],
  ["/facebook/react", REPO_HOME],
  ["/facebook/react/tree/main/src", REPO_HOME],
];

/** Pages of GitHub's that this extension has no screen for, and must not claim. */
const THEIRS: Array<string> = [
  // The tabs beside a pull request are GitHub's on purpose: this interface replaces
  // the conversation, and Files, Commits and Checks are theirs.
  "/facebook/react/pull/1749/files",
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
];

/** A whole address as the two halves `placeOwning` is asked with. */
const owningOf = (address: string): Place | null => {
  const at = address.indexOf("?");
  return at === -1
    ? placeOwning(address)
    : placeOwning(address.slice(0, at), address.slice(at));
};

describe("which addresses belong to which page", () => {
  test.each(ADDRESSES)("%s is the %s", (address, place) => {
    expect(owningOf(address)?.name).toBe(place.name);
  });

  test.each(THEIRS)("%s stays GitHub's", (address: string) => {
    expect(owningOf(address)).toBeNull();
  });

  test("every place says which addresses are its own", () => {
    // The compiler already asks for the field. This asks that it was answered with
    // something, rather than with a rule that is false everywhere.
    const said = PLACES.filter((place) =>
      ADDRESSES.some(([address]) => {
        const at = address.indexOf("?");
        return at === -1
          ? place.owns(address)
          : place.owns(address.slice(0, at), address.slice(at));
      }),
    );

    expect(said).toHaveLength(PLACES.length);
  });
});

/**
 * The dashboard at `/pulls`, down to the parts a takeover depends on. Copied
 * from the live document rather than invented — `scripts/probe-pulls-dom.js`
 * printed this tree, hashes and all.
 */
const dashboard = (): Document => {
  const page = document.implementation.createHTMLDocument("github");
  page.body.innerHTML = `
    <div class="header-wrapper"><header>site nav</header></div>
    <main>
      <react-app app-name="dashboard-surface">
        <div>
          <section data-testid="global-sso-banner">single sign-on has expired</section>
          <div data-testid="pulls-dashboard-surface-layout">
            <div class="prc-PageLayout-PageLayoutRoot--KH-d">
              <div class="prc-PageLayout-PageLayoutWrapper-2BhU2">
                <div class="prc-PageLayout-PageLayoutContent-BneH9">
                  <div class="prc-PageLayout-PaneWrapper-pHPop">their filters</div>
                  <div class="prc-PageLayout-ContentWrapper-gR9eG">their rows</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </react-app>
    </main>`;
  return page;
};

/**
 * Whether a reader would see it. Ancestors count: the takeover hides the slot's
 * own children, and everything under one of those goes with it.
 */
const visible = (page: Document, text: string): boolean => {
  const found = [...page.querySelectorAll("*")].find(
    (element) => element.textContent?.trim() === text,
  );
  if (found === undefined) return false;

  for (let at: Element | null = found; at !== null; at = at.parentElement) {
    if (at.hasAttribute("hidden")) return false;
  }
  return true;
};

describe("taking over the pull request dashboard", () => {
  test("finds GitHub's whole two-column layout, pane and rows together", () => {
    // Both, because the Working Set brings its own filtering: their pane left
    // beside it would be a second set of controls disagreeing with the first
    // about what is on the screen.
    const page = dashboard();

    const slot = findSlot(page, DASHBOARD);

    expect(slot?.getAttribute("data-testid")).toBe(
      "pulls-dashboard-surface-layout",
    );
  });

  test("puts the interface in it and hides what GitHub drew", () => {
    const page = dashboard();
    const container = interfaceContainer(page);

    const takeover = takeOverSlot(page, container, DASHBOARD);

    expect(takeover).not.toBeNull();
    expect(container.parentElement?.getAttribute("data-testid")).toBe(
      "pulls-dashboard-surface-layout",
    );
    expect(visible(page, "their filters")).toBe(false);
    expect(visible(page, "their rows")).toBe(false);
  });

  test("leaves the single sign-on banner alone", () => {
    // An expired single sign-on is the one thing on this page a reader may need
    // more than their pull requests, and it sits outside the region taken.
    const page = dashboard();

    takeOverSlot(page, interfaceContainer(page), DASHBOARD);

    expect(visible(page, "single sign-on has expired")).toBe(true);
  });

  test("gives the page back whole", () => {
    const page = dashboard();

    takeOverSlot(page, interfaceContainer(page), DASHBOARD)?.stepAside();

    expect(visible(page, "their filters")).toBe(true);
    expect(visible(page, "their rows")).toBe(true);
    expect(page.getElementById(ROOT_ID)).toBeNull();
  });

  test("does not take a dashboard when told to look for a conversation", () => {
    // The two pages share Primer's layout classes, so the pull request place
    // matches this document as well. Which is why each script says where it is
    // rather than letting the selectors decide.
    const page = dashboard();

    const asConversation = findSlot(page, CONVERSATION);

    expect(asConversation?.className).toContain("PageLayoutContent");
  });
});

/**
 * The home dashboard at `/`, down to the parts a takeover depends on. Copied from
 * the live document rather than invented — `scripts/probe-home-dom.js` printed this
 * tree, class hashes and all.
 *
 * Unlike the other three this page is Rails-rendered, so the hooks are an id, two
 * long-standing class names and GitHub's own `partial-name` attributes rather than
 * anything React puts on the page.
 */
const home = (): Document => {
  const page = document.implementation.createHTMLDocument("github");
  page.body.innerHTML = `
    <div class="position-relative header-wrapper js-header-wrapper">
      <react-partial partial-name="global-nav-bar" class="loaded">site nav</react-partial>
    </div>
    <div class="application-main">
      <div class="color-bg-default">
        <div class="d-md-flex feed-background">
          <aside class="feed-left-sidebar col-md-4 col-lg-3 border-right" aria-label="Account">
            <div class="dashboard-sidebar">
              <div class="px-2">
                <react-partial partial-name="dashboard-repositories" class="loaded">
                  <nav data-testid="dashboard-repositories">their repositories</nav>
                </react-partial>
              </div>
            </div>
          </aside>
          <div class="flex-auto col-md-8 col-lg-8">
            <div class="tmp-pt-4 d-flex feed-content flex-column flex-xl-row">
              <div class="overflow-x-hidden d-flex flex-auto flex-column dashboard-route feed-main__universe">
                <div class="feed-main__universe--spinner">their spinner</div>
                <main class="flex-1">
                  <div>
                    <div id="dashboard" class="dashboard">
                      <h1 class="sr-only">Dashboard</h1>
                      <div class="news">
                        <div class="copilotPreview__container">
                          <react-partial partial-name="copilot-chat-input-partial" class="loaded">their greeting and chat box</react-partial>
                        </div>
                        <react-partial partial-name="dashboard-lists" class="loaded">their pull requests and issues</react-partial>
                      </div>
                    </div>
                  </div>
                </main>
              </div>
              <aside class="feed-right-column d-block tmp-mb-5" aria-label="Explore">
                their trending repositories
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  return page;
};

describe("taking over the home dashboard", () => {
  test("finds the centre column and not the whole page", () => {
    const page = home();

    const slot = findSlot(page, HOME);

    expect(slot?.id).toBe("dashboard");
  });

  test("takes their greeting and their chat box with the region", () => {
    /*
     * Measured rather than assumed: `div.copilotPreview__container` holds the
     * greeting, the Preview chip, the ask box and the five action buttons in one
     * element, and it sits inside the region — so the thing 200 people asked to be
     * able to switch off goes with the takeover rather than needing a rule.
     */
    const page = home();
    const container = interfaceContainer(page, HOME);

    takeOverSlot(page, container, HOME);

    expect(visible(page, "their greeting and chat box")).toBe(false);
    expect(visible(page, "their pull requests and issues")).toBe(false);
  });

  test("takes the repositories sidebar, which the Rail replaces", () => {
    // Outside `main` and outside the region, so this one has to be named: two lists
    // of repositories on one screen is the duplication their own readers asked them
    // to end.
    const page = home();

    takeOverSlot(page, interfaceContainer(page, HOME), HOME);

    expect(visible(page, "their repositories")).toBe(false);
  });

  test("leaves the site header alone", () => {
    // How somebody gets around the rest of GitHub. It already works, and replacing
    // it would only make this page stranger than the one beside it.
    const page = home();

    takeOverSlot(page, interfaceContainer(page, HOME), HOME);

    expect(visible(page, "site nav")).toBe(true);
  });

  test("gives the page back whole", () => {
    const page = home();

    takeOverSlot(page, interfaceContainer(page, HOME), HOME)?.stepAside();

    expect(visible(page, "their greeting and chat box")).toBe(true);
    expect(visible(page, "their pull requests and issues")).toBe(true);
    expect(visible(page, "their repositories")).toBe(true);
    expect(page.getElementById(ROOT_ID)).toBeNull();
  });
});

/**
 * The feed at `/feed`, which is the page this one has to be told apart from.
 *
 * Copied from the live document by `scripts/probe-home-dom.js`'s sibling read. It is a
 * different controller — `dashboard_feed#show` rather than `dashboard#index` — and it
 * shares the sidebar to the attribute while naming its own column `#feed.dashboard`
 * rather than `#dashboard.dashboard`.
 */
const feed = (): Document => {
  const page = document.implementation.createHTMLDocument("github");
  page.body.innerHTML = `
    <div class="application-main">
      <div class="color-bg-default">
        <div class="d-md-flex feed-background">
          <aside class="feed-left-sidebar col-md-4 col-lg-3 border-right" aria-label="Account">
            <div class="dashboard-sidebar">their account and their repositories</div>
          </aside>
          <div class="flex-auto col-md-8 col-lg-8">
            <div class="tmp-pt-4 d-flex feed-content flex-column flex-xl-row">
              <div class="overflow-x-hidden d-flex flex-auto flex-column dashboard-route feed-main__universe">
                <div class="feed-main__universe--spinner">their spinner, which this page has too</div>
                <main class="flex-1">
                  <div id="feed" class="dashboard">
                    <h1 class="sr-only">Feed</h1>
                    <div class="news"><feed-container>their feed</feed-container></div>
                  </div>
                </main>
              </div>
              <aside class="feed-right-column d-block tmp-mb-5" aria-label="Explore">
                the same panel, which this page has too
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  return page;
};

/**
 * The rules are switched on at the press, while the page being left is still the page
 * on the screen — so every selector this place names has to be false on any *other*
 * page that carries the same markup. The feed is the one that does: GitHub named the
 * home page's own furniture `feed-left-sidebar` and `feed-background`, and the sidebar
 * really is the same element on both.
 */
describe("what the home place is allowed to match", () => {
  test("nothing at all on the feed, which shares the sidebar", () => {
    const page = feed();

    for (const band of HOME.bands) expect(page.querySelector(band)).toBeNull();
    for (const stage of HOME.stages ?? HOME.regions)
      expect(page.querySelector(stage)).toBeNull();
  });

  test("and every one of its own hooks on home itself", () => {
    // The other half of the same guard: a selector narrowed until it is false on the
    // feed is worthless if it went false on home as well.
    const page = home();

    for (const band of HOME.bands)
      expect(page.querySelector(band)).not.toBeNull();
    for (const stage of HOME.stages ?? HOME.regions) {
      expect(page.querySelector(stage)).not.toBeNull();
    }
  });
});

/**
 * A repository's front page with a branch banner on it, down to the parts a band has
 * to match.
 *
 * The chain is copied from a live repository, where the code view app is a child of
 * the pjax container rather than the other way round, and the banner sits four boxes
 * inside that app in `OverviewHeader`. The banner's own markup is the shipped
 * component's, read out of the code view bundle rather than off the screen: the
 * banner is drawn for a branch pushed within the hour, and no repository this account
 * can push to had one while this was written.
 *
 * `RecentlyTouchedBranches` renders one warning Flash per branch — an icon, a link to
 * the branch, the words "had recent pushes", and the button that offers to open the
 * pull request. The hash on the class is the one that shipped in
 * `60092.e749e6cc81e0f69e.module.css`, and it is an argument here because a band that
 * needed that exact hash would stop matching on GitHub's next deploy.
 */
const repoHome = (hash = "reMRu"): Document => {
  const page = document.implementation.createHTMLDocument("github");
  page.body.innerHTML = `
    <div class="application-main">
      <main id="js-repo-pjax-container">
        <div id="repository-container-header"></div>
        <turbo-frame id="repo-content-turbo-frame">
          <div id="repo-content-pjax-container" class="repository-content">
            <react-app app-name="code-view" class="loaded">
              <div data-target="react-app.reactRoot">
                <div class="prc-PageLayout-PageLayoutContent-BneH9">
                  <div id="repos-split-pane-content" class="SharedPageLayout-module__content__IwGAp">
                    <div class="OverviewContent-module__Box__PF75K">
                      <div class="OverviewHeader-module__Box__cC1RH">
                        <div class="flash flash-warn RecentlyTouchedBranches-module__Flash__${hash}">
                          <div class="RecentlyTouchedBranches-module__Box__d6v2n">
                            <a class="text-bold" href="/facebook/react/tree/fix">fix</a>
                            had recent pushes 4 minutes ago
                          </div>
                          <a class="prc-Button-ButtonBase-c50BI" href="/facebook/react/compare/fix?expand=1">Compare &amp; pull request</a>
                        </div>
                      </div>
                      <div>their file list and README</div>
                    </div>
                  </div>
                </div>
              </div>
            </react-app>
          </div>
        </turbo-frame>
      </main>
    </div>`;
  return page;
};

/** Whatever a place's bands find on a page, which is what a gate rule would hide. */
const banded = (page: Document, place: Place): ReadonlyArray<Element> =>
  place.bands.flatMap((band) => [...page.querySelectorAll(band)]);

/**
 * The banner GitHub draws above a repository's files when a branch was pushed to in
 * the last hour, which 407 readers asked to be able to switch off for branches they
 * do not care about.
 */
describe("the branch banner on a repository's front page", () => {
  test("is named by the repository front page's bands", () => {
    const page = repoHome();

    const found = banded(page, REPO_HOME);

    expect(found).toHaveLength(1);
    expect(found[0]?.textContent).toContain("had recent pushes");
  });

  test("and the button offering the pull request goes with it", () => {
    // Inside the Flash rather than beside it, so the row is one element to hide and
    // not two. A band that took only the sentence would leave the button standing.
    const page = repoHome();

    expect(banded(page, REPO_HOME)[0]?.textContent).toContain(
      "Compare & pull request",
    );
  });

  test("and is found again when the deploy hash on the class changes", () => {
    // The whole reason the band names a fragment: `RecentlyTouchedBranches-module__
    // Flash__reMRu` is that deploy's class, and next week's is the same name with
    // five other characters on the end.
    const page = repoHome("Qk3Zt");

    expect(banded(page, REPO_HOME)[0]?.textContent).toContain(
      "had recent pushes",
    );
  });

  test("and matches nothing on the other pages this extension stands on", () => {
    // These rules are switched on at the press, while the page being left is still
    // the page on the screen, so a band true anywhere else takes a piece of a page
    // somebody is still reading.
    for (const page of [dashboard(), home(), feed()]) {
      for (const band of REPO_HOME.bands)
        expect(page.querySelector(band)).toBeNull();
    }
  });
});

/**
 * One of a person's three pages, down to the parts a takeover and a gate depend on.
 *
 * Copied from the three fetched documents rather than invented: `/flazouh`,
 * `?tab=repositories` and `?tab=stars` all serve one `div.container-xl` holding a
 * `Layout` whose sidebar is their `h-card` column and whose main is their tab row
 * above `turbo-frame#user-profile-frame`, with a sticky copy of the face and the tabs
 * above the lot. Each fills the frame with something the other two do not have, which
 * is the whole difficulty on these pages: the address is one path and the frame is one
 * element.
 */
const person = (tab: "profile" | "repositories" | "stars"): Document => {
  const page = document.implementation.createHTMLDocument("github");
  const inside = {
    profile: `<include-fragment src="/users/flazouh?action=show&amp;controller=profiles&amp;tab=contributions">their calendar</include-fragment>`,
    repositories: `<div id="user-repositories-list"><ul><li>their repository rows</li></ul></div><div class="paginate-container">their pager</div>`,
    stars: `<turbo-frame id="user-starred-repos"><ol><li>their starred rows</li></ol></turbo-frame><div class="paginate-container">their pager</div>`,
  }[tab];

  page.body.innerHTML = `
    <div class="application-main">
      <main>
        <div class="tmp-mt-4 position-sticky top-0" data-turbo-frame="user-profile-frame">
          <div class="container-xl">
            <div class="Layout Layout--flowRow-until-md">
              <div class="Layout-sidebar">
                <div class="user-profile-sticky-bar">their face and tabs again, floating</div>
              </div>
              <div class="Layout-main">their sticky tab row</div>
            </div>
          </div>
        </div>
        <div class="container-xl px-3">
          <div class="Layout Layout--flowRow-until-md">
            <div class="Layout-sidebar">
              <div class="h-card">
                <span class="vcard-username">flazouh</span>
                <div class="js-profile-editable-replace">their face, name, bio and follower counts</div>
              </div>
            </div>
            <div class="Layout-main">
              <nav class="UnderlineNav-body">their tab row</nav>
              <turbo-frame id="user-profile-frame">${inside}</turbo-frame>
            </div>
          </div>
        </div>
      </main>
    </div>`;
  return page;
};

/**
 * The three tabs are one frame under one path, so the proof of which tab a press is
 * going to has to be the content of the frame. These rules are switched on at the
 * press, while the tab being left is still on the screen — a proof true on a
 * neighbouring tab would blank the page the reader is still reading.
 */
describe("telling a person's three tabs apart", () => {
  const proofOf = (place: Place): string =>
    (place.stages ?? place.regions)
      .map((stage) => `${stage}${place.soft?.holding ?? ""}`)
      .join(", ");

  test.each([
    [PROFILE, "profile"],
    [PERSON_REPOS, "repositories"],
    [PERSON_STARS, "stars"],
  ] as const)("%s is proved on its own tab", (place, tab) => {
    expect(person(tab).querySelector(proofOf(place))).not.toBeNull();
  });

  test.each([
    [PROFILE, "repositories", "stars"],
    [PERSON_REPOS, "profile", "stars"],
    [PERSON_STARS, "profile", "repositories"],
  ] as const)("%s is false on the other two", (place, one, other) => {
    expect(person(one).querySelector(proofOf(place))).toBeNull();
    expect(person(other).querySelector(proofOf(place))).toBeNull();
  });

  test("all three take the whole band, their column with it", () => {
    // The column is drawn by this interface now rather than left in GitHub's type
    // beside a list in ours: `personIn` reads the face, the name, the bio and the
    // counts out of the markup this hides, so nothing on the page is lost by hiding
    // it. One page, one hand.
    const page = person("repositories");

    takeOverSlot(page, interfaceContainer(page, PERSON_REPOS), PERSON_REPOS);

    expect(visible(page, "their repository rows")).toBe(false);
    expect(visible(page, "their tab row")).toBe(false);
    expect(visible(page, "their face, name, bio and follower counts")).toBe(false);
  });

  test("and their sticky bar, which would otherwise slide over ours", () => {
    // A direct child of `main` and outside the region, so it has to be named: their
    // second copy of the face and the tab row floats at the top of the window as a
    // reader scrolls.
    const page = person("repositories");

    takeOverSlot(page, interfaceContainer(page, PERSON_REPOS), PERSON_REPOS);

    expect(visible(page, "their face and tabs again, floating")).toBe(false);
  });

  test("and give the page back whole", () => {
    const page = person("stars");

    takeOverSlot(
      page,
      interfaceContainer(page, PERSON_STARS),
      PERSON_STARS,
    )?.stepAside();

    expect(visible(page, "their starred rows")).toBe(true);
    expect(page.getElementById(ROOT_ID)).toBeNull();
  });

  test("nothing is taken on an organisation, which shares the address", () => {
    // No `user-profile-frame` and no profile sidebar on an organisation, measured on
    // `/microsoft`. So the region is not there, the gate is false, and the screen
    // has nowhere to stand — which is how an organisation stays GitHub's.
    const org = document.implementation.createHTMLDocument("github");
    org.body.innerHTML = `<main><div id="org-repositories">their organisation page</div></main>`;

    for (const place of [PROFILE, PERSON_REPOS, PERSON_STARS]) {
      for (const region of place.regions)
        expect(org.querySelector(region)).toBeNull();
      expect(org.querySelector(proofOf(place))).toBeNull();
    }
  });
});

/**
 * A reader moving from the Working Set to a pull request, which is the case that
 * wedged a real tab.
 *
 * Both scripts are running for a moment: the list is still on the page when the
 * card's script starts. They cannot share one container — every stylesheet here is
 * scoped to `#gitquiet-root`, so there is one of those, and two takeovers holding
 * the same element move it back and forth between their regions on each other's
 * mutations until the tab stops responding.
 */
describe("two interfaces in one document", () => {
  const bothPages = (): Document => {
    const page = document.implementation.createHTMLDocument("github");
    page.body.innerHTML = `
      <main>
        <react-app app-name="dashboard-surface">
          <div data-testid="pulls-dashboard-surface-layout"><div>their rows</div></div>
        </react-app>
        <react-app app-name="pull-requests">
          <div class="prc-PageLayout-PageLayoutContent-BneH9">their conversation</div>
        </react-app>
      </main>`;
    return page;
  };

  test("the second interface does not adopt the first one's container", () => {
    const page = bothPages();
    const list = interfaceContainer(page, DASHBOARD);
    takeOverSlot(page, list, DASHBOARD);

    const card = interfaceContainer(page, CONVERSATION);

    expect(card).not.toBe(list);
  });

  test("and takes the id with it, so only one thing is styled", () => {
    const page = bothPages();
    const list = interfaceContainer(page, DASHBOARD);
    takeOverSlot(page, list, DASHBOARD);

    const card = interfaceContainer(page, CONVERSATION);
    takeOverSlot(page, card, CONVERSATION);

    expect(page.querySelectorAll(`#${ROOT_ID}`)).toHaveLength(1);
    expect(page.getElementById(ROOT_ID) === card).toBe(true);
    expect(list.isConnected).toBe(false);
  });

  test("the same script asking twice gets the same container back", () => {
    // Only a different interface is turned away. A second copy of one script must
    // find what the first built, or it would tear down a working page.
    const page = bothPages();

    const first = interfaceContainer(page, DASHBOARD);
    takeOverSlot(page, first, DASHBOARD);

    expect(interfaceContainer(page, DASHBOARD)).toBe(first);
  });

  test("each interface ends up in its own region", () => {
    const page = bothPages();
    const list = interfaceContainer(page, DASHBOARD);
    takeOverSlot(page, list, DASHBOARD);

    const card = interfaceContainer(page, CONVERSATION);
    takeOverSlot(page, card, CONVERSATION);

    expect(card.parentElement?.className).toContain("PageLayoutContent");
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Option } from "effect";
import type { Destination } from "../domain/Settings";
import type { RepositoryAtWork } from "../domain/rail";
import type { Repository } from "../domain/repositories";
import { sittingsIn } from "../domain/sittings";
import type { InvolvedPullRequest, Shelf } from "../domain/workingSet";
import { Rail } from "./Rail";
import { WorkingSetScreen } from "./WorkingSetScreen";

afterEach(cleanup);

const at = (
  repo: string,
  count: number,
  yourMove: number,
): RepositoryAtWork => ({
  owner: "flazouh",
  repo,
  name: repo,
  count,
  yourMove,
});

const owned = (
  nameWithOwner: string,
  over: Partial<Repository> = {},
): Repository => {
  const [owner = "", repo = ""] = nameWithOwner.split("/");
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false,
    ...over,
  };
};

const showing = (
  over: {
    atWork?: ReadonlyArray<RepositoryAtWork>;
    yourMove?: number;
    happened?: number;
    destination?: Destination;
    onDestination?: (destination: Destination) => void;
    repositories?: ReadonlyArray<Repository>;
    collapsed?: boolean;
    onCollapsed?: (collapsed: boolean) => void;
    participant?: Repository extends never ? never : { login: string; faceUrl: Option.Option<string> };
    pinned?: ReadonlyArray<string>;
    onPinned?: (pinned: ReadonlyArray<string>) => void;
  } = {},
) =>
  render(
    <Rail
      pinned={over.pinned}
      onPinned={over.onPinned}
      destination={over.destination ?? "working-set"}
      onDestination={over.onDestination ?? (() => undefined)}
      atWork={over.atWork ?? []}
      yourMove={over.yourMove ?? 0}
      happened={over.happened}
      repositories={over.repositories}
      collapsed={over.collapsed}
      onCollapsed={over.onCollapsed}
      participant={over.participant}
    />,
  );

const rail = () => screen.getByRole("navigation", { name: "Rail" });

/**
 * The strip that answers "where else?" without a back button.
 *
 * Two taps to a repository is the most-repeated complaint in GitHub's own threads, and
 * leaving a pull request on their soft navigation is a back button that sometimes does
 * not work. Both are answered by navigation that is simply always there — which is why
 * the tests below are about what a reader can reach rather than about how it looks.
 */
describe("the Rail", () => {
  test("offers all three Destinations", () => {
    showing();

    expect(within(rail()).getByRole("button", { name: /Working Set/ })).toBeDefined();
    expect(within(rail()).getByRole("button", { name: /Repositories/ })).toBeDefined();
    expect(within(rail()).getByRole("button", { name: /Activity/ })).toBeDefined();
  });

  test("says which Destination the reader is on", () => {
    showing({ destination: "activity" });

    expect(
      screen.getByRole("button", { current: "page" }).textContent,
    ).toContain("Activity");
  });

  test("takes a press on a Destination there", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ onDestination: (which) => went.push(which) });

    await person.click(screen.getByRole("button", { name: /Repositories/ }));

    expect(went).toEqual(["repositories"]);
  });

  test("counts what is the reader's own move beside the Working Set", () => {
    showing({ yourMove: 4 });

    expect(
      screen.getByRole("button", { name: "Working Set, 4" }),
    ).toBeDefined();
  });

  test("counts what happened beside Activity, once that read has landed", () => {
    showing({ happened: 26 });

    expect(screen.getByRole("button", { name: "Activity, 26" })).toBeDefined();
  });

  test("says nothing about how much happened before anybody has read it", () => {
    // A zero beside Activity would be a claim that nothing has happened, which is a
    // different thing from not having asked yet.
    showing();

    expect(screen.getByRole("button", { name: "Activity" })).toBeDefined();
  });

  test("lists the repositories the reader's work is in, in the order given", () => {
    showing({ atWork: [at("octo-repo", 3, 2), at("githubpro", 1, 0)] });

    const rows = within(
      screen.getByRole("list", { name: "Repositories you are working in" }),
    ).getAllByRole("link");

    // By address rather than by text: the letter standing in for a missing face is in the
    // text content and is nothing a reader is being asked to read.
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/flazouh/octo-repo/pulls",
      "/flazouh/githubpro/pulls",
    ]);
  });

  test("takes a press on a repository to its pull requests", () => {
    // Their own page for it, which this extension already draws: the complaint is the
    // two taps, not the destination.
    showing({ atWork: [at("octo-repo", 3, 2)] });

    expect(
      screen.getByRole("link", { name: /octo-repo/ }).getAttribute("href"),
    ).toBe("/flazouh/octo-repo/pulls");
  });

  test("says nothing about repositories when nothing has been read", () => {
    showing();

    expect(
      screen.queryByRole("list", { name: "Repositories you are working in" }),
    ).toBeNull();
  });
});

describe("finding a repository by typing", () => {
  const many = [
    owned("flazouh/octo-repo"),
    owned("flazouh/lumen"),
    owned("flowline-labs/flowline"),
  ];

  test("searches every repository, not the handful with work in them", async () => {
    // Story 5, and the difference between this and GitHub's own sidebar: theirs lists ten
    // by a rule nobody can predict, and a live account had 154.
    const person = userEvent.setup();
    showing({ atWork: [at("octo-repo", 3, 2)], repositories: many });

    await person.type(screen.getByRole("searchbox"), "flowline");

    const rows = within(
      screen.getByRole("list", { name: "Repositories that match" }),
    ).getAllByRole("link");
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/flowline-labs/flowline/pulls",
    ]);
  });

  test("says so when nothing matches, and how much was searched", async () => {
    const person = userEvent.setup();
    showing({ repositories: many });

    await person.type(screen.getByRole("searchbox"), "nowhere");

    expect(screen.getByText(/Nothing matches nowhere, of 3/)).toBeDefined();
  });

  test("Escape gives the reader their own list back", async () => {
    const person = userEvent.setup();
    showing({ atWork: [at("octo-repo", 3, 2)], repositories: many });

    await person.type(screen.getByRole("searchbox"), "lumen");
    await person.keyboard("{Escape}");

    expect(
      screen.getByRole("list", { name: "Repositories you are working in" }),
    ).toBeDefined();
  });

  test("a slash from anywhere lands in the filter", async () => {
    // Their own `/` reaches for GitHub's search, which is not this page's search while
    // this page is the one being read.
    const person = userEvent.setup();
    showing({ repositories: many });

    await person.keyboard("/");

    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });

  test("no filter before the whole list has been read", () => {
    // A box that searches six of a hundred and fifty-four is a box that lies.
    showing({ atWork: [at("octo-repo", 3, 2)] });

    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

describe("narrowing the Rail", () => {
  test("does not offer Home; the top bar already does", () => {
    showing();

    expect(within(rail()).queryByRole("link", { name: "Home" })).toBeNull();
    expect(screen.getByRole("button", { name: "Narrow the Rail" })).toBeDefined();
  });

  test("keeps the counts, which is what makes narrowing safe", async () => {
    // Narrow is a working state rather than a hidden one. A reader who narrows the Rail
    // should lose the words and keep the answer to "is anything mine?".
    const person = userEvent.setup();
    showing({ atWork: [at("octo-repo", 3, 2)], yourMove: 4 });

    await person.click(screen.getByRole("button", { name: "Narrow the Rail" }));

    expect(within(rail()).getByText("4")).toBeDefined();
    // The words are still in the document, blurred away and marked hidden rather than
    // removed: taking them out on the frame the width starts moving read as the label
    // vanishing and the strip catching up afterwards. What a reader can reach is
    // unchanged, which is what this asserts.
    expect(within(rail()).getByText("Working Set").getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Working Set, 4" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Widen the Rail" })).toBeDefined();
  });

  test("still says where a repository goes once the words are gone", async () => {
    const person = userEvent.setup();
    showing({ atWork: [at("octo-repo", 3, 2)] });

    await person.click(screen.getByRole("button", { name: "Narrow the Rail" }));

    expect(
      screen.getByRole("link", { name: /octo-repo/ }).getAttribute("href"),
    ).toBe("/flazouh/octo-repo/pulls");
  });

  test("tells whoever is remembering, so a reload does not undo it", async () => {
    const person = userEvent.setup();
    const remembered: Array<boolean> = [];
    showing({ onCollapsed: (narrow) => remembered.push(narrow) });

    await person.click(screen.getByRole("button", { name: "Narrow the Rail" }));
    await person.click(screen.getByRole("button", { name: "Widen the Rail" }));

    expect(remembered).toEqual([true, false]);
  });

  test("starts narrow when that is what was remembered", () => {
    showing({ collapsed: true, yourMove: 2 });

    expect(screen.getByRole("button", { name: "Widen the Rail" })).toBeDefined();
    expect(within(rail()).getByText("2")).toBeDefined();
  });

  test("takes the remembered width even though it arrives late", () => {
    // Settings are read from storage, so the first render of the Rail is always the default
    // one. Ignoring the answer when it lands looked precisely like a width that was never
    // remembered, which is how this was found on the live page rather than here.
    const { rerender } = render(
      <Rail
        destination="working-set"
        onDestination={() => undefined}
        atWork={[]}
        yourMove={0}
        collapsed={false}
      />,
    );

    rerender(
      <Rail
        destination="working-set"
        onDestination={() => undefined}
        atWork={[]}
        yourMove={0}
        collapsed
      />,
    );

    expect(screen.getByRole("button", { name: "Widen the Rail" })).toBeDefined();
  });
});

describe("the Participant's own menu", () => {
  const participant = { login: "flazouh", faceUrl: Option.none<string>() };

  test("is three rows a reader goes to on a working day", async () => {
    // GitHub's own account menu has thirty, several of which sell a plan. The complaint is
    // not that it is untidy; it is that the few things anybody presses are buried in it.
    // The way back to their page was a fourth row here and is a button in the bar now,
    // which is the one place it is the same on every screen.
    const person = userEvent.setup();
    showing({ participant });

    await person.click(
      screen.getByRole("button", { name: /flazouh and your account/ }),
    );

    const menu = screen.getByRole("menu", { name: "Your account" });
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(3);
    expect(within(menu).queryByRole("menuitem", { name: /GitHub/ })).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Sign out" }).getAttribute("href"),
    ).toBe("/logout");
    expect(
      within(menu).getByRole("menuitem", { name: "Your profile" }).getAttribute("href"),
    ).toBe("/flazouh");
  });

  test("is shut until it is asked for", () => {
    showing({ participant });

    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("is not drawn at all when nobody is signed in", () => {
    showing();

    expect(screen.queryByRole("button", { name: /your account/ })).toBeNull();
  });
});

const involved = (
  number: number,
  repo: string,
  shelf: Shelf,
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
  ...{},
});

const onScreen = (
  home: boolean,
  over: {
    destination?: Destination;
    elsewhere?: (destination: "repositories" | "activity") => React.ReactNode;
    rows?: ReadonlyArray<InvolvedPullRequest>;
  } = {},
) =>
  render(
    <WorkingSetScreen
      load={() =>
        Effect.succeed(
          sittingsIn(
            over.rows ?? [
              involved(1, "octo-repo", "needs-action"),
              involved(2, "gitquiet", "waiting-for-review"),
            ],
            () => Option.none(),
          ),
        )
      }
      onOpen={() => {}}
      onStepAside={() => {}}
      home={home}
      destination={over.destination}
      elsewhere={over.elsewhere}
    />,
  );

/**
 * Where the Rail is, which is a question about GitHub's page rather than about ours.
 *
 * Home is the page whose navigation this extension takes: their sidebar of repositories
 * is hidden, and their own readers asked for one of those lists rather than two. Their
 * pull request dashboard is not — their nav is still up the page there — so a Rail on it
 * would be the duplication the Rail exists to end.
 */
describe("the Rail on the Working Set", () => {
  test("stands beside the list on Home, holding the repositories it read", async () => {
    onScreen(true);

    await waitFor(() => expect(rail()).toBeDefined());

    // Derived from the same read the Courts were drawn from, so it names both.
    await waitFor(() => expect(within(rail()).getByText("octo-repo")).toBeDefined());
    expect(within(rail()).getByText("gitquiet")).toBeDefined();
    // One is the reader's move, and the Working Set Destination says so.
    expect(
      within(rail()).getByRole("button", { name: "Working Set, 1" }),
    ).toBeDefined();
  });

  test("is not on their pull request dashboard, where their own nav still is", async () => {
    onScreen(false);

    await waitFor(() => expect(screen.getByRole("searchbox")).toBeDefined());
    expect(
      screen.queryByRole("navigation", { name: "Rail" }),
    ).toBeNull();
  });

  test("draws whichever Destination the reader chose", async () => {
    onScreen(true, {
      destination: "activity",
      elsewhere: (which) => <p>the {which} Destination</p>,
    });

    await waitFor(() =>
      expect(screen.getByText("the activity Destination")).toBeDefined(),
    );
  });

  test("an empty Working Set offers the repositories rather than an empty page", async () => {
    // The one moment GitHub's dashboard actively wastes somebody's time: nothing waiting
    // on you, and a blank column to look at.
    onScreen(true, {
      rows: [],
      elsewhere: (which) => <p>the {which} Destination</p>,
    });

    await waitFor(() =>
      expect(screen.getByText(/Nothing is waiting on you/)).toBeDefined(),
    );
    expect(screen.getByText("the repositories Destination")).toBeDefined();
  });
});

/**
 * What the face at the foot of the Rail is for.
 *
 * GitHub's own account menu is thirty rows, most of them somewhere nobody goes on a
 * working day and two of them advertisements. The three here are the ones the spec names.
 * Handing the page back to GitHub was a fourth and is not in a menu any more: it is the
 * control a reader wants when something of ours is drawn badly, so it is a button in the
 * bar, in the same corner of every screen this extension draws.
 */
describe("the Participant menu", () => {
  const me = { login: "flazouh", faceUrl: Option.none<string>() };

  test("holds the three rows and nothing else", async () => {
    const person = userEvent.setup();
    showing({ participant: me });

    await person.click(screen.getByRole("button", { name: /flazouh/ }));

    const menu = screen.getByRole("menu", { name: "Your account" });
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(3);
    expect(within(menu).getByRole("menuitem", { name: /Settings/ })).toBeDefined();
    expect(within(menu).getByRole("menuitem", { name: /Sign out/ })).toBeDefined();
  });

  test("does not offer the way back to GitHub, the bar above it having it", async () => {
    const person = userEvent.setup();
    showing({ participant: me });

    await person.click(screen.getByRole("button", { name: /flazouh/ }));

    const menu = screen.getByRole("menu", { name: "Your account" });
    expect(within(menu).queryByRole("menuitem", { name: /GitHub/ })).toBeNull();
  });

  test("shuts on Escape", async () => {
    const person = userEvent.setup();
    showing({ participant: me });

    await person.click(screen.getByRole("button", { name: /flazouh/ }));
    await person.keyboard("{Escape}");

    expect(screen.queryByRole("menu", { name: "Your account" })).toBeNull();
  });
});

/**
 * Starting something.
 *
 * "There is no button to create a new repository any more" is its own ask in their thread,
 * and the reason it went is the chat box that took its place. Three verbs, from the Rail,
 * at both widths — a create action that disappears when the Rail narrows is a create
 * action a reader stops trusting.
 */
describe("the create action", () => {
  test("offers a repository, an issue and a pull request", async () => {
    const person = userEvent.setup();
    showing({ repositories: [owned("flazouh/octo-repo")] });

    await person.click(within(rail()).getByRole("button", { name: /Create/ }));

    const menu = screen.getByRole("menu", { name: "Create" });
    expect(within(menu).getByRole("menuitem", { name: /repository/i })).toBeDefined();
    expect(within(menu).getByRole("menuitem", { name: /issue/i })).toBeDefined();
    expect(within(menu).getByRole("menuitem", { name: /pull request/i })).toBeDefined();
  });

  test("is there when the Rail is narrow", () => {
    showing({ collapsed: true });

    expect(within(rail()).getByRole("button", { name: /Create/ })).toBeDefined();
  });
});

/**
 * Reaching a Destination without the Rail.
 *
 * The landing choice is only a convenience if the other two are one chord away — the whole
 * argument GitHub lost by picking a side for everybody. `g d` is unchanged from what
 * Participants already press for their dashboard and said so in as many words.
 */
describe("the Destination chords", () => {
  test("takes g r to the repositories", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ onDestination: (which) => went.push(which) });

    await person.keyboard("gr");

    expect(went).toEqual(["repositories"]);
  });

  test("takes g d back to the Working Set from anywhere", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ destination: "activity", onDestination: (which) => went.push(which) });

    await person.keyboard("gd");

    expect(went).toEqual(["working-set"]);
  });

  test("answers a chord while the Repositories filter owns the slash", async () => {
    // That Destination has a filter of its own, so the Rail gives up `/` there. Giving up
    // the chords with it would have made the one Destination a reader lands on the one they
    // cannot leave by keyboard.
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ destination: "repositories", onDestination: (which) => went.push(which) });

    await person.keyboard("gf");

    expect(went).toEqual(["activity"]);
  });

  test("leaves g alone on its own", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ onDestination: (which) => went.push(which) });

    await person.keyboard("g");

    expect(went).toEqual([]);
  });
});

/**
 * Pinning a repository, as many as a reader likes.
 *
 * GitHub allows six, which is a number about their layout rather than about anybody's work,
 * and their own discussion #28350 is about exactly that. Pinned repositories are the list
 * above the work, because a reader who pinned one said it matters whether or not there is a
 * pull request in it this week.
 */
describe("pinned repositories", () => {
  const two = [owned("flazouh/octo-repo"), owned("citrolabs/ego-lite")];

  test("are listed above the repositories with work in them", () => {
    showing({ repositories: two, pinned: ["citrolabs/ego-lite"], atWork: [at("octo-repo", 3, 1)] });

    const pinned = screen.getByRole("list", { name: "Repositories you pinned" });
    expect(within(pinned).getByRole("link", { name: /ego-lite/ })).toBeDefined();
  });

  test("are not repeated in the list below", () => {
    showing({ repositories: two, pinned: ["flazouh/octo-repo"], atWork: [at("octo-repo", 3, 1)] });

    const work = screen.queryByRole("list", {
      name: "Repositories you are working in",
    });
    expect(work === null || within(work).queryByRole("link", { name: /octo-repo/ }) === null).toBe(
      true,
    );
  });

  test("take a press to pin, and tell whoever is remembering", async () => {
    const person = userEvent.setup();
    const asked: Array<ReadonlyArray<string>> = [];
    showing({
      repositories: two,
      atWork: [at("octo-repo", 3, 1)],
      onPinned: (pinned) => asked.push(pinned),
    });

    await person.click(screen.getByRole("button", { name: "Pin flazouh/octo-repo" }));

    expect(asked).toEqual([["flazouh/octo-repo"]]);
  });

  test("take a press to unpin", async () => {
    const person = userEvent.setup();
    const asked: Array<ReadonlyArray<string>> = [];
    showing({
      repositories: two,
      pinned: ["flazouh/octo-repo"],
      onPinned: (pinned) => asked.push(pinned),
    });

    await person.click(screen.getByRole("button", { name: "Unpin flazouh/octo-repo" }));

    expect(asked).toEqual([[]]);
  });

  test("hold more than the six GitHub allows", () => {
    const seven = Array.from({ length: 7 }, (_, index) => owned(`flazouh/repo${index}`));
    showing({ repositories: seven, pinned: seven.map((one) => one.nameWithOwner) });

    const pinned = screen.getByRole("list", { name: "Repositories you pinned" });
    expect(within(pinned).getAllByRole("link")).toHaveLength(7);
  });
});

describe("widening for the filter", () => {
  test("does it between two frames, because a box that is still moving cannot be typed into", async () => {
    showing({ collapsed: true });

    await userEvent.keyboard("/")

    // The mark that tells the stylesheet this width came from a keypress and is not to be
    // travelled to. A reader who pressed `/` is already typing; 260ms of strip travel arrives
    // under their first letters, with the box they are aiming at somewhere else while it does.
    expect(rail().getAttribute("data-snap")).toBe("");
    expect(rail().getAttribute("data-narrow")).toBeNull();
  })

  test("lands in the box it opened, which did not exist when the key was pressed", async () => {
    // The whole point of `/`: widen, then type. A narrow Rail has no filter in it at all, so
    // reaching for one on the same tick as the widening reached for nothing and left the caret
    // on the page — the reader's next six letters going to GitHub's own shortcuts instead.
    // Enough of them that the filter is offered at all: a box that searches six of a hundred
    // and fifty-four is a box that lies, so the Rail withholds it until the list is whole.
    showing({
      collapsed: true,
      repositories: Array.from({ length: 30 }, (_, index) => owned(`flazouh/repo${index}`)),
    });

    await userEvent.keyboard("/")

    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  })

  test("keeps the travel for a press on the widen control, which is a hand and not a key", async () => {
    showing({ collapsed: true });

    await userEvent.click(screen.getByRole("button", { name: /widen the rail/i }))

    expect(rail().getAttribute("data-snap")).toBeNull()
  })
})

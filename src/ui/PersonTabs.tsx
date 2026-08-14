import { HERE } from "./dress"

/** The three of their tabs this interface draws, in their own order. */
const TABS = [
  { on: "overview", name: "Overview", where: (login: string) => `/${login}` },
  {
    on: "repositories",
    name: "Repositories",
    where: (login: string) => `/${login}?tab=repositories`
  },
  { on: "stars", name: "Stars", where: (login: string) => `/${login}?tab=stars` }
] as const

export type PersonTab = (typeof TABS)[number]["on"]

/**
 * A person's own tabs, drawn rather than read off their page.
 *
 * The opposite of a repository's tabs, which are read out of their nav — see
 * `theirNav.ts` — because a repository has nine of them, in an order the owner
 * changes, and half are settings-dependent. A person has the same tabs as every
 * other person, and three of those are drawn here: the other five are named in
 * `docs/spec/profile.md` as out of scope, so a row read off their page would offer
 * five presses that hand the reader back to GitHub.
 *
 * Their sidebar is untouched and stays. This row is the only thing that says which
 * of the three the reader is on, since the frame is shared by all of them.
 */
export const PersonTabs = ({
  login,
  on
}: {
  readonly login: string
  readonly on: PersonTab
}) => (
  <nav aria-label={`${login}'s pages`} className="flex min-w-0 items-center gap-1 px-1">
    {TABS.map((tab) => (
      <a
        key={tab.on}
        href={tab.where(login)}
        /* Said as well as painted, and `page` rather than `location`: each of these is
           the page itself rather than a section holding it. */
        aria-current={tab.on === on ? "page" : undefined}
        className={`rounded-md px-2 py-1 text-sm no-underline ${
          tab.on === on ? `${HERE} font-semibold` : "text-ink-muted hover:bg-hover hover:text-ink"
        }`}
      >
        {tab.name}
      </a>
    ))}
  </nav>
)

import { Option } from "effect"
import type { Person } from "../domain/person"
import { ASIDE, HERE } from "./dress"

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
 * The counts on it are theirs all the same. They sit in the nav this row replaces and
 * they are the only honest totals on the page: the walk over their list stops at a cap,
 * and the stars tab is not read at all, so a number counted here would disagree with
 * their own page on exactly the accounts where it matters. See `Person.tally`.
 */
export const PersonTabs = ({
  login,
  on,
  who
}: {
  readonly login: string
  readonly on: PersonTab
  /** Their counts, where the column was read. The row draws without them either way. */
  readonly who?: Person
}) => {
  const tally: Readonly<Record<PersonTab, Option.Option<string>>> = {
    overview: Option.none(),
    repositories: who?.tally.repositories ?? Option.none(),
    stars: who?.tally.stars ?? Option.none()
  }

  return (
    <nav
      aria-label={`${login}'s pages`}
      className="t-panel-fade flex min-w-0 items-center gap-1 border-line-muted border-b pb-1.5"
    >
      {TABS.map((tab) => (
        <a
          key={tab.on}
          href={tab.where(login)}
          /* Said as well as painted, and `page` rather than `location`: each of these is
             the page itself rather than a section holding it. */
          aria-current={tab.on === on ? "page" : undefined}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm no-underline ${
            tab.on === on ? `${HERE} font-semibold` : "text-ink-muted hover:bg-hover hover:text-ink"
          }`}
        >
          {tab.name}
          {Option.match(tally[tab.on], {
            onNone: () => null,
            onSome: (many) => <span className={`${ASIDE} tabular-nums`}>{many}</span>
          })}
        </a>
      ))}
    </nav>
  )
}

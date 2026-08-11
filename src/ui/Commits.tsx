import type { Commit } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { useArt } from "./art"
import { NEAR, useNearby } from "./near"
import { Section } from "./Section"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * The count, and how long since the last one.
 *
 * What becomes of them on merge is the merge card's business, not this one's:
 * it depends on the button pressed and on which repository this is, and saying
 * "squashed into one" here was a claim about our own button made in a section
 * that only lists what happened. The age is the part worth reading at a glance
 * — a branch nobody has touched in three weeks is a different thing to review
 * than one still moving.
 */
const howMany = (commits: ReadonlyArray<Commit>): string => {
  if (commits.length === 0) return "none yet"

  const newest = commits.reduce(
    (latest, commit) => (commit.createdAt > latest ? commit.createdAt : latest),
    commits[0]?.createdAt ?? ""
  )
  const age = ageOf(newest)
  if (commits.length === 1) return age === "" ? "one" : `one, ${age}`

  return age === "" ? `${commits.length}` : `${commits.length}, newest ${age}`
}

/**
 * The commits, folded away.
 *
 * Deliberately not a panel. The wall of commits is what this interface exists
 * to take down, and on a branch an agent wrote most of them say "fix lint" —
 * reading them is not how anyone reviews. But nothing else here shows them and
 * GitHub's own tab is hidden, so this is the way back to a sha when a check
 * blames one, and it is closed until then.
 */
export const Commits = ({
  commits,
  repository,
  onOpen,
  onWarm,
  opened
}: {
  readonly commits: ReadonlyArray<Commit>
  readonly repository?: PullRequestRef
  /** Reads this commit in the panel beside, when anything is wired to do that. */
  readonly onOpen?: (sha: string) => void
  /** Called as the pointer nears a row, in time to have read it before the click. */
  readonly onWarm?: (sha: string) => void
  readonly opened?: string
}) => {
  const art = useArt()
  const ChevronRight = art["chevron-right"]

  // The pointer on its way down the list has already said which row it is
  // going to reach; reading that commit now is the difference between a click
  // that opens something and a click that starts waiting for it.
  const nearby = useNearby<string>({
    onNear: (sha) => onWarm?.(sha),
    enabled: onWarm !== undefined
  })

  return (
  <Section name="Commits" summary={howMany(commits)}>
    {commits.length === 0 ? (
      <></>
    ) : (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs text-ink-muted hover:bg-hover [&::-webkit-details-marker]:hidden">
          <ChevronRight
            size={12}
            className="shrink-0 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] group-open:rotate-90"
          />
          Show them
        </summary>
        {/* Opened, all of them: the fold is what keeps the wall of commits out
          of the way, so once someone has asked for it there is no second limit
          to fight. */}
        <div ref={nearby} className="divide-y divide-line-muted border-t border-line-muted">
          {commits.map((commit) => (
            <a
              key={commit.sha}
              // A real link even when it opens beside: the address is worth
              // copying, and a modified click still belongs to GitHub.
              href={
                repository === undefined
                  ? undefined
                  : `https://github.com/${repository.owner}/${repository.repo}/commit/${commit.sha}`
              }
              onClick={
                onOpen === undefined
                  ? undefined
                  : (event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey) return
                      event.preventDefault()
                      onOpen(commit.sha)
                    }
              }
              {...{ [NEAR]: commit.sha }}
              aria-current={commit.sha === opened ? "true" : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-hover ${
                commit.sha === opened ? "bg-hover" : ""
              }`}
            >
              <Who login={commit.author} />
              <code className="shrink-0 font-mono text-xs text-ink-muted">
                {commit.abbreviatedSha}
              </code>
              <span className="min-w-0 flex-1 truncate text-xs">{commit.headline}</span>
              <span
                title={momentOf(commit.createdAt)}
                className="shrink-0 text-xs text-ink-muted tabular-nums"
              >
                {ageOf(commit.createdAt)}
              </span>
            </a>
          ))}
        </div>
      </details>
    )}
    </Section>
  )
}

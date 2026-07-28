import {
  ArrowRightIcon,
  ArrowSwitchIcon,
  CopyIcon,
  LinkExternalIcon
} from "@primer/octicons-react"
import { useState } from "react"
import type { PullRequestSnapshot, PullRequestState } from "../domain/PullRequest"
import { toUrl } from "../domain/PullRequestRef"
import { pullRequestArt } from "./Icon"

const STATE_TONE: Record<PullRequestState, string> = {
  open: "bg-pass-emphasis text-ink-on-emphasis",
  draft: "bg-surface text-ink-muted",
  merged: "bg-done-emphasis text-ink-on-emphasis",
  closed: "bg-fail-emphasis text-ink-on-emphasis"
}

const STATE_WORD: Record<PullRequestState, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed"
}

const Branch = ({ name }: { readonly name: string }) => (
  <span className="rounded-md border border-line-muted px-1.5 py-0.5 font-mono text-xs text-ink">
    {name}
  </span>
)

/** A control that looks like the ones in the sections below it, and no other. */
const Action = ({
  label,
  href,
  onClick,
  children
}: {
  readonly label: string
  readonly href?: string
  readonly onClick?: () => void
  readonly children: React.ReactNode
}) => {
  const dressed =
    "flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover"

  return href === undefined ? (
    <button type="button" aria-label={label} onClick={onClick} className={dressed}>
      {children}
    </button>
  ) : (
    <a href={href} aria-label={label} className={dressed}>
      {children}
    </a>
  )
}

/**
 * Which pull request this is, as a card rather than as loose text.
 *
 * Everything else on this screen is a bordered panel with a heading strip and
 * its content beneath, so a bare row of text floating above them read as a
 * fragment of GitHub's page that had been left behind. Same border, same
 * surfaces, two strips: what it is called, and then the facts about it —
 * author, branches, size — on the recessed one, where the eye goes second.
 */
export const Header = ({
  snapshot,
  onUseGitHub
}: {
  readonly snapshot: PullRequestSnapshot
  /**
   * Hands the page back to GitHub and remembers that this is what was wanted.
   * Absent in a test, and in any other place that has no page to hand back.
   */
  readonly onUseGitHub?: () => void
}) => {
  const Art = pullRequestArt(snapshot.state)
  const added = snapshot.files.reduce((sum, file) => sum + file.linesAdded, 0)
  const deleted = snapshot.files.reduce((sum, file) => sum + file.linesDeleted, 0)
  const url = toUrl(snapshot.reference)
  const [copied, setCopied] = useState(false)

  return (
    <header className="mb-1.5 shrink-0 overflow-hidden rounded-md border border-line">
      <div className="flex items-center gap-2.5 bg-surface px-3 py-2.5">
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATE_TONE[snapshot.state]}`}
        >
          <Art size={12} />
          {STATE_WORD[snapshot.state]}
        </span>

        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
          {snapshot.title}
          <span className="pl-2 font-normal text-ink-muted">{`#${snapshot.reference.number}`}</span>
        </h1>

        <Action
          label={copied ? "Link copied" : "Copy link"}
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => setCopied(true))
          }}
        >
          <CopyIcon size={12} />
          {copied ? "Copied" : "Copy link"}
        </Action>
        <Action label="Open on GitHub" href={url}>
          <LinkExternalIcon size={12} />
          GitHub
        </Action>
        {/* Beside the link to GitHub rather than in the settings menu: this is
            the one control that takes the interface away, and burying the exit
            inside the thing being exited is how software earns a bad name. */}
        {onUseGitHub === undefined ? null : (
          <Action label="Read GitHub's own page instead" onClick={onUseGitHub}>
            <ArrowSwitchIcon size={12} />
            GitHub's page
          </Action>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-inset px-3 py-1.5 text-xs text-ink-muted">
        <span className="shrink-0 font-semibold text-ink">{snapshot.author.login}</span>
        <span className="shrink-0">wants to merge</span>
        <Branch name={snapshot.headBranch} />
        <ArrowRightIcon size={12} className="shrink-0" />
        <Branch name={snapshot.baseBranch} />
        <span className="ml-auto shrink-0 tabular-nums">
          {`${snapshot.files.length} ${snapshot.files.length === 1 ? "file" : "files"}`}{" "}
          <span className="text-pass">+{added}</span> <span className="text-fail">−{deleted}</span>
        </span>
      </div>
    </header>
  )
}

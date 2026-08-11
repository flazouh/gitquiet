/**
 * One tab of a repository's row.
 *
 * Named here rather than beside either of the two things that read it, because both do: the
 * bar draws these, and the gateway reads them out of a document and keeps them. See
 * `src/github/repoTabs.ts` for why they are read at all rather than written out as a list.
 */
export type Tab = {
  /** What it says: "Code", "Pull requests", "Security and quality". */
  readonly name: string
  readonly href: string
  /** Their own count, where the tab carries one. Issues and Pull requests do; the rest do not. */
  readonly count?: number
  /** Whether GitHub says this is the tab being looked at. */
  readonly here: boolean
}

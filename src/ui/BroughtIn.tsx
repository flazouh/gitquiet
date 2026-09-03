import { Effect } from "effect"
import { useEffect, useMemo, useState } from "react"
import type { Uploaded } from "../domain/attaching"
import { quoting } from "../domain/fileAt"
import { hunted } from "../domain/hunting"
import type { RepoRef } from "../domain/PullRequestRef"
import type { Suggesting } from "../domain/suggesting"
import type { Picked } from "../ports/Renderer"
import { HERE, PRESSABLE } from "./dress"
import { Field } from "./Field"
import { FileMark } from "./FileHeading"
import { Note } from "./Note"
import { WholeFile } from "./WholeFile"

export type BroughtInProps = {
  readonly repo: RepoRef
  /**
   * The commit the file is read at, and the one its address names.
   *
   * A sha and never a branch. The whole point of the address this writes is
   * that the lines it names stay the lines it named, and a branch moves.
   */
  readonly headSha: string
  /** Every path in the repository at that commit. Read once, when first hunted. */
  readonly paths: () => Effect.Effect<ReadonlyArray<string>, unknown>
  /** One whole file at that commit. */
  readonly readFile: (path: string) => Effect.Effect<string, unknown>
  /** Sends what was written to the pull request's conversation. */
  readonly onSay?: (body: string) => Effect.Effect<unknown, unknown>
  /** Puts the diff back, which is what this pane replaced. */
  readonly onClose: () => void
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
}

/** How many paths the hunt offers at once. More than a reader reads already. */
const OFFERED = 12

/**
 * A file the pull request did not change, brought in to read and to quote.
 *
 * The answer to [community #9099](https://github.com/orgs/community/discussions/9099),
 * where a reader wants to say something about a file the change did not touch —
 * "this breaks because of the helper in `config.zig`, and you did not change
 * `config.zig`". GitHub has no review thread for that. Their route takes one and
 * then draws it in no diff and names no file, which is worse than refusing it.
 *
 * So what a reader marks here becomes a Remark on the conversation carrying a
 * permalink to those lines, which GitHub renders as a box naming the file, the
 * line and the commit with the code quoted under it. Measured; see
 * `docs/spec/github-write-api.md`.
 *
 * Nothing about this pretends to be a review thread. There is no Resolve, no
 * side, and no row hung in a diff, because none of those exist for a file that
 * is not in the comparison.
 */
export const BroughtIn = ({
  repo,
  headSha,
  paths,
  readFile,
  onSay,
  onClose,
  viewer,
  suggest,
  onUpload
}: BroughtInProps) => {
  const [typed, setTyped] = useState("")
  const [every, setEvery] = useState<ReadonlyArray<string> | undefined>(undefined)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [lines, setLines] = useState<ReadonlyArray<string> | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<Picked | null>(null)

  /*
   * Every path, read once and only once somebody types.
   *
   * It is one request and a large answer — seven thousand paths on
   * `facebook/react`, per the gateway's own note — so a reader who never brings
   * a file in never pays for it.
   */
  useEffect(() => {
    if (typed.trim() === "" || every !== undefined) return

    void Effect.runPromise(
      paths().pipe(Effect.match({ onSuccess: setEvery, onFailure: () => setEvery([]) }))
    )
  }, [typed, every, paths])

  const offered = useMemo(() => hunted(every ?? [], typed, OFFERED), [every, typed])

  useEffect(() => {
    if (chosen === undefined) return
    let wanted = true
    setLines(undefined)
    setFailed(false)

    void Effect.runPromise(
      readFile(chosen).pipe(
        Effect.match({
          onSuccess: (text) => {
            if (wanted) setLines(text.split("\n"))
          },
          onFailure: () => {
            if (wanted) setFailed(true)
          }
        })
      )
    )

    return () => {
      wanted = false
    }
  }, [chosen, readFile])

  const open = (path: string) => {
    setChosen(path)
    setPicked(null)
    setTyped("")
  }

  return (
    <section
      aria-label="A file brought in"
      /* The dress the diff's own panel wears, because this stands in the same
         place and replaces it. The line and the corner are the sheet's to give,
         not this file's: see `dress.ts`, which exists because two cards once
         argued about them. */
      className="t-panel-fade flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-surface"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {chosen === undefined ? (
          <span className="text-sm text-ink">Bring in a file this pull request did not change</span>
        ) : (
          <FileMark path={chosen} icons="material" />
        )}
        <span className="ml-auto shrink-0">
          <button type="button" onClick={onClose} className={`${PRESSABLE} px-2 py-0.5 text-xs`}>
            Back to the diff
          </button>
        </span>
      </div>

      {chosen === undefined ? (
        <div className="min-w-0 p-3">
          <Field value={typed} onChange={setTyped} label="Find a file" art="search" room="tight" />
          {typed.trim() === "" ? (
            <p className="px-1 py-2 text-xs text-ink-muted">
              Type part of a path. Nothing you say here is a review thread: GitHub has none for a
              file outside the change, so it goes to the conversation quoting the lines you mark.
            </p>
          ) : offered.length === 0 ? (
            <p className="px-1 py-2 text-xs text-ink-muted">
              {every === undefined ? "Reading this repository's files…" : "No path like that."}
            </p>
          ) : (
            <ul className="pt-1">
              {offered.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => open(path)}
                    className={`${HERE} flex w-full items-center gap-2 rounded px-1 py-1 text-left`}
                  >
                    <FileMark path={path} icons="material" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-auto">
          {failed ? (
            <p className="px-4 py-3 text-sm text-ink-muted">
              This file could not be read at this commit. GitHub may not have it there.
            </p>
          ) : lines === undefined ? (
            <p className="px-4 py-3 text-sm text-ink-muted">Reading this file…</p>
          ) : (
            <>
              {picked === null ? (
                <p className="border-b border-line px-3 py-1.5 text-xs text-ink-muted">
                  Mark some lines to say something about them.
                </p>
              ) : (
                <div className="w-[min(46rem,100%)] border-b border-line px-3 py-2">
                  <Note
                    from={picked.from}
                    to={picked.to}
                    body=""
                    viewer={viewer}
                    onPost={
                      onSay === undefined
                        ? undefined
                        : (body) =>
                            /*
                             * The address first and the sentence under it, which
                             * is the order a diff reads in: the code, then what
                             * somebody said about it.
                             */
                            Effect.map(
                              onSay(
                                `${quoting(
                                  { owner: repo.owner, repo: repo.repo, on: headSha, path: chosen },
                                  { from: picked.from, to: picked.to }
                                )}\n\n${body}`
                              ),
                              () => setPicked(null)
                            )
                    }
                    onDiscard={() => setPicked(null)}
                    suggest={suggest}
                    onUpload={onUpload}
                  />
                </div>
              )}
              <WholeFile path={chosen} lines={lines} onPick={setPicked} />
            </>
          )}
        </div>
      )}
    </section>
  )
}

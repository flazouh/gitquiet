import { useState } from "react"
import type { GistSeen } from "../domain/gist"
import { everyLabelKnown, type KeptGists, labelsOf, nameOf } from "../domain/gistLabels"
import { GitHubHtml } from "./GitHubHtml"
import { TheBar } from "./TheBar"

/**
 * One gist — `gist.github.com/{owner}/{id}`.
 *
 * Everything their page carries, plus the warning it never had. The Secret notice is a
 * panel here rather than a `.flash` borrowed from GitHub's stylesheet, which is the one
 * change of substance: on their page it was a banner planted above their markup, and on
 * this one it is part of the page.
 *
 * See `plans/007-give-the-gists-a-screen.md`.
 */

export type GistScreenProps = {
  readonly gist: GistSeen
  readonly kept: KeptGists
  readonly onChange: (id: string, labels: ReadonlyArray<string>, name: string | null) => void
  /** Restores GitHub's own page, which is still behind this. */
  readonly onStepAside: () => void
}

/**
 * What Secret actually means, said where the reader is looking at the gist.
 *
 * The wording is the spec's and is deliberate: not "this is public", which is wrong, and
 * not "this is private", which is the belief being corrected. Recorded across three
 * sources — Reddit 2019 at 16 upvotes, Hacker News 2022 and 2025 — people acting on the
 * belief that a secret gist is access-controlled. It is not. The link is the whole of it.
 */
const SecretNotice = () => (
  <div className="rounded-md bg-attention-muted p-3 text-sm">
    Secret means anyone with this link can see this gist — it is not private. The link is
    the only thing keeping it out of a search engine, and once shared it cannot be taken
    back.
  </div>
)

/** "6 forks", and nothing where there are none. Their head does the same. */
const Count = ({ many, one, href }: { many: number; one: string; href: string }) =>
  many === 0 ? null : (
    <a href={href} className="text-xs text-ink-muted hover:underline">
      {many} {one}
      {many === 1 ? "" : "s"}
    </a>
  )

export const GistScreen = ({ gist, kept, onChange, onStepAside }: GistScreenProps) => {
  const labels = labelsOf(kept, gist.id)
  const name = nameOf(kept, gist.id)
  const known = everyLabelKnown(kept)

  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(labels.join(", "))
  const [called, setCalled] = useState(name ?? "")

  const at = `/${gist.owner}/${gist.id}`

  const save = (): void => {
    onChange(
      gist.id,
      typed
        .split(",")
        .map((one) => one.trim())
        .filter((one) => one.length > 0),
      called.trim().length === 0 ? null : called.trim()
    )
    setOpen(false)
  }

  return (
    <>
      <TheBar where={{ kind: "home" }} />
      <div className="t-panels flex flex-col gap-3 py-3">
        <div className="rounded-md bg-raised p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <a href={`/${gist.owner}`} className="text-sm text-ink-muted hover:underline">
              {gist.owner}
            </a>
            <span className="text-ink-muted">/</span>
            <h1 className="text-base font-semibold">{name ?? gist.title}</h1>
            {name === null ? null : (
              <span className="text-xs text-ink-muted">{gist.title}</span>
            )}
            {gist.secret ? (
              <span className="rounded-full bg-attention-muted px-2 text-xs text-ink">
                Secret
              </span>
            ) : null}
          </div>

          {gist.description === null ? null : (
            <p className="mt-1 max-w-prose text-sm text-ink-muted">{gist.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Count many={gist.files.length} one="file" href={at} />
            <Count many={gist.revisions} one="revision" href={`${at}/revisions`} />
            <Count many={gist.forks} one="fork" href={`${at}/forks`} />
            <Count many={gist.stars} one="star" href={`${at}/stargazers`} />
            <Count many={gist.comments} one="comment" href={`${at}#comments`} />
            {gist.updatedAt === "" ? null : (
              <span className="text-xs text-ink-muted">
                {new Date(gist.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/*
            Their own controls, as links to their own pages rather than reimplemented.
            Editing, deleting and starring a gist are writes with no route this extension
            has any business inventing a second way to make.
          */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a href={`${at}/edit`} className="h-7 rounded-md bg-surface px-3 text-xs leading-7">
              Edit
            </a>
            <a href={`${at}/revisions`} className="h-7 rounded-md bg-surface px-3 text-xs leading-7">
              Revisions
            </a>
            <a href={`${at}/download`} className="h-7 rounded-md bg-surface px-3 text-xs leading-7">
              Download ZIP
            </a>
            <button
              type="button"
              onClick={() => setOpen((was) => !was)}
              className="h-7 rounded-md bg-surface px-3 text-xs"
            >
              Label / name…
            </button>
            <button
              type="button"
              onClick={onStepAside}
              className="h-7 rounded-md px-2 text-xs text-ink-muted hover:bg-hover"
            >
              Show GitHub&rsquo;s page
            </button>
          </div>

          {labels.length === 0 ? null : (
            <div className="mt-2 flex flex-wrap gap-1">
              {labels.map((label) => (
                <span key={label} className="rounded-full bg-hover px-2 text-xs text-ink-muted">
                  {label}
                </span>
              ))}
            </div>
          )}

          {open ? (
            <div className="mt-2 flex flex-col gap-2 border-t border-line-muted pt-2">
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Name
                <input
                  value={called}
                  onChange={(event) => setCalled(event.target.value)}
                  placeholder={gist.title}
                  className="h-8 rounded-md bg-hover px-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Labels, separated by commas
                <input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  list="gist-labels-known"
                  className="h-8 rounded-md bg-hover px-2 text-sm"
                />
              </label>
              <datalist id="gist-labels-known">
                {known.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  className="h-7 rounded-md bg-accent-emphasis px-3 text-xs text-ink-on-emphasis"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 rounded-md px-3 text-xs text-ink-muted hover:bg-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {gist.secret ? <SecretNotice /> : null}

        {gist.files.map((file) => (
          <div key={file.name} className="rounded-md bg-raised">
            <div className="flex items-center justify-between border-b border-line-muted px-3 py-2">
              <span className="text-xs font-semibold">{file.name}</span>
              <span className="flex items-center gap-2">
                {file.language === null ? null : (
                  <span className="text-xs text-ink-muted">{file.language}</span>
                )}
                {file.raw === null ? null : (
                  <a href={file.raw} className="text-xs text-ink-muted hover:underline">
                    Raw
                  </a>
                )}
              </span>
            </div>
            {file.html === null ? (
              <pre className="overflow-auto p-3 text-xs">{file.content}</pre>
            ) : (
              // What GitHub already rendered, kept as markup. Its text alone is the
              // README with every heading, list and code block flattened into one
              // paragraph, which is what this drew before.
              <div className="p-3">
                <GitHubHtml html={file.html} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

import type { Effect } from "effect"
import { useState } from "react"
import type { GistSeen } from "../domain/gist"
import { everyLabelKnown, type KeptGists, labelsOf, nameOf } from "../domain/gistLabels"
import { CARD, CARD_HEAD } from "./dress"
import { Count, LabelAndName, LabelChips } from "./GistMarks"
import { GistTalk } from "./GistTalk"
import { GitHubHtml } from "./GitHubHtml"
import { Section } from "./Section"
import { TheBar } from "./TheBar"
import { ageOf, momentOf } from "./when"

/**
 * One gist — `gist.github.com/{owner}/{id}`.
 *
 * Two columns, the way a pull request is drawn: what this gist is on the left — what it
 * is called, what it is worth knowing about it, and what anybody said — and the files
 * themselves on the right. Their own page stacks the two, so the conversation is under
 * every file and a reader of a four-file gist never reaches it.
 *
 * The Secret notice is a panel here rather than a `.flash` borrowed from GitHub's
 * stylesheet: on their page it was a banner planted above their markup, and on this one
 * it is part of the page.
 *
 * See `plans/007-give-the-gists-a-screen.md`.
 */

export type GistScreenProps = {
  readonly gist: GistSeen
  readonly kept: KeptGists
  readonly onChange: (id: string, labels: ReadonlyArray<string>, name: string | null) => void
  /** Whoever is signed in, so the box at the foot is signed as the comment will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /** Whether the older comments their page held back are being fetched right now. */
  readonly reading?: boolean
  /** Reads the comments their page held back. Absent where it held none. */
  readonly onEarlier?: () => void
  /** Says something under this gist. Absent where GitHub drew no box. */
  readonly onSay?: (body: string) => Effect.Effect<unknown, unknown>
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

/** One file, drawn as their page drew it: prose where they rendered it, lines where they did not. */
const FileView = ({ file }: { readonly file: GistSeen["files"][number] }) => (
  <section aria-label={file.name} className={`shrink-0 overflow-hidden ${CARD}`}>
    <div className={CARD_HEAD}>
      <span className="min-w-0 truncate text-xs font-semibold">{file.name}</span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
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
      <pre className="overflow-auto px-3 pb-3 text-xs">{file.content}</pre>
    ) : (
      // What GitHub already rendered, kept as markup. Its text alone is the README with
      // every heading, list and code block flattened into one paragraph, which is what
      // this drew before.
      <div className="px-3 pb-3">
        <GitHubHtml html={file.html} />
      </div>
    )}
  </section>
)

export const GistScreen = ({
  gist,
  kept,
  onChange,
  viewer,
  reading,
  onEarlier,
  onSay,
  onStepAside
}: GistScreenProps) => {
  const labels = labelsOf(kept, gist.id)
  const name = nameOf(kept, gist.id)
  const known = everyLabelKnown(kept)

  const [open, setOpen] = useState(false)
  const at = `/${gist.owner}/${gist.id}`

  return (
    <>
      <TheBar where={{ kind: "home" }} />
      {/*
        No frame of its own. The shell puts one inset on `#gitquiet-root` for every screen
        at once — see `widths.test.ts`.

        Aligned to the top rather than stretched: the column on the left is as tall as
        what the author wrote and what anybody said, which is nobody's business but its own.
      */}
      <div className="t-panels flex items-start gap-1.5 py-3">
        <div className="flex w-[26rem] shrink-0 flex-col gap-1.5">
          <Section
            name="This gist"
            heading={
              <span className="flex min-w-0 items-baseline gap-2">
                <a href={`/${gist.owner}`} className="shrink-0 text-ink-muted hover:underline">
                  {gist.owner}
                </a>
                <span className="text-ink-muted">/</span>
                <span className="min-w-0 truncate text-ink">{name ?? gist.title}</span>
              </span>
            }
            aside={
              gist.secret ? (
                <span className="rounded-full bg-attention-muted px-2 text-xs text-ink">
                  Secret
                </span>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-2 px-3 py-2">
              {name === null ? null : (
                <span className="text-xs text-ink-muted">{gist.title}</span>
              )}

              {gist.description === null ? null : (
                <p className="max-w-prose text-sm text-ink-muted">{gist.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Count many={gist.files.length} one="file" href={at} />
                <Count many={gist.revisions} one="revision" href={`${at}/revisions`} />
                <Count many={gist.forks} one="fork" href={`${at}/forks`} />
                <Count many={gist.stars} one="star" href={`${at}/stargazers`} />
                {/*
                  Their own word for what this date is. Their head prints "Created" over
                  it, and a bare date beside four counts reads as the day something last
                  happened — which on a gist edited this morning is a year out.
                */}
                {gist.updatedAt === "" ? null : (
                  <span className="text-xs text-ink-muted" title={momentOf(gist.updatedAt)}>
                    Created {ageOf(gist.updatedAt)}
                  </span>
                )}
              </div>

              {/*
                Their own controls, as links to their own pages rather than reimplemented.
                Deleting and starring a gist are writes with no route this extension has
                any business inventing a second way to make. Editing is a form GitHub
                already knows how to post, and it gets room rather than a rebuild — see
                `gistEditing.css`.
              */}
              <div className="flex flex-wrap items-center gap-2">
                <a href={`${at}/edit`} className="h-7 rounded-md bg-surface px-3 text-xs leading-7">
                  Edit
                </a>
                <a
                  href={`${at}/revisions`}
                  className="h-7 rounded-md bg-surface px-3 text-xs leading-7"
                >
                  Revisions
                </a>
                <a
                  href={`${at}/download`}
                  className="h-7 rounded-md bg-surface px-3 text-xs leading-7"
                >
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

              <LabelChips labels={labels} />

              {open ? (
                <LabelAndName
                  id={gist.id}
                  title={gist.title}
                  labels={labels}
                  name={name}
                  known={known}
                  onChange={onChange}
                  onClose={() => setOpen(false)}
                />
              ) : null}
            </div>
          </Section>

          {gist.secret ? <SecretNotice /> : null}

          <GistTalk
            said={gist.said}
            earlier={gist.earlierSaid !== null}
            viewer={viewer}
            keep={`gist:${gist.owner}/${gist.id}`}
            reading={reading}
            onEarlier={onEarlier}
            onSay={onSay}
          />
        </div>

        {/* The files, which is what the reader came for, taking whatever width is left. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {gist.files.map((file) => (
            <FileView key={file.name} file={file} />
          ))}
        </div>
      </div>
    </>
  )
}

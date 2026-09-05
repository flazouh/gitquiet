import { Effect } from "effect"
import { useState } from "react"
import {
  kept,
  refusedFor,
  withFile,
  withOneMore,
  without,
  type DraftFile,
  type GistDraft
} from "../domain/gistEdit"
import { CARD, CARD_HEAD, FIELD } from "./dress"
import { TheBar } from "./TheBar"

/**
 * Writing a gist — `gist.github.com/` to make one, `/{owner}/{id}/edit` to change one.
 *
 * The fourth pain point in the notes repository's `research/gist-pain-points.md`, and the
 * only one of the four that is a layout complaint rather than a missing feature. Reddit,
 * 2024, 23 points: "I find the edit window is extremely tiny to be usable... To be able
 * to modify a code efficiently the display I would expect it to take the full width least
 * and be much taller." The top reply is resignation rather than a fix: "I never actually
 * write code in the online gist editor, I just paste some finalized code blocks into it."
 * GitHub Community #13206 says it twice more: "the Gist window is soo small", "is not
 * resizable". Measured live, signed in, on 2026-09-02 in a 1256 by 888 window: their
 * `.CodeMirror` is 978 wide and 322 tall, a third of the height of the window it is in.
 *
 * `docs/spec/gists.md` answered that with a stylesheet, on the reasoning that the editor
 * is a form GitHub already knows how to post and rebuilding one would mean owning gist
 * creation. Half of that is still true and is why this screen posts *their* form: every
 * field, their token, their honeypot, read off the page and sent back with the reader's
 * files in it. See `gistEditForm.ts`. What the stylesheet could not fix is that their
 * editor is their editor — a reader who has spent the day in this interface met a
 * different one the moment they pressed Edit.
 *
 * A plain textarea rather than a code editor. What was being asked for is room, and a
 * syntax-highlighted box this extension maintains is a second editor to keep working
 * against a form whose shape is GitHub's to change.
 */

export type GistEditScreenProps = {
  /** The gist as their form found it, which is what this opens on. */
  readonly draft: GistDraft
  /** What their own submit button says, so this says the same thing. */
  readonly words: string
  /** Sends the draft, as their form. Says nothing back: a success is a page load. */
  readonly onSave: (draft: GistDraft) => Effect.Effect<unknown, unknown>
  /** Where the reader goes when they do not save. Their gist, or their list. */
  readonly back: string
  /** Restores GitHub's own editor, which is still on the page behind this. */
  readonly onStepAside: () => void
}

/**
 * One file: its name, and the room the whole complaint is about.
 *
 * The box is `60vh` where the gist has one file and `24rem` where it has several — a
 * gist of four files whose boxes are each two thirds of the window is a page nobody can
 * see the shape of, and the complaint is about not having room rather than about every
 * file filling a screen. Resizable either way, which their own is not.
 */
const FileEditor = ({
  file,
  alone,
  onName,
  onContent,
  onRemove
}: {
  readonly file: DraftFile
  readonly alone: boolean
  readonly onName: (name: string) => void
  readonly onContent: (content: string) => void
  readonly onRemove: () => void
}) => (
  <section aria-label={file.name === "" ? "New file" : file.name} className={`shrink-0 ${CARD}`}>
    <div className={CARD_HEAD}>
      <input
        value={file.name}
        onChange={(event) => onName(event.target.value)}
        aria-label="Filename including extension"
        placeholder="Filename including extension…"
        className={`h-7 w-72 px-2 text-xs ${FIELD}`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="ml-auto rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-hover hover:text-fail"
      >
        Remove
      </button>
    </div>
    <textarea
      value={file.content}
      onChange={(event) => onContent(event.target.value)}
      aria-label={`Contents of ${file.name === "" ? "the new file" : file.name}`}
      placeholder="Enter file contents here"
      spellCheck={false}
      className={`block w-full resize-y px-3 py-2 font-mono text-xs leading-5 ${FIELD} ${
        alone ? "min-h-[60vh]" : "min-h-[24rem]"
      }`}
    />
  </section>
)

export const GistEditScreen = ({
  draft: opened,
  words,
  onSave,
  back,
  onStepAside
}: GistEditScreenProps) => {
  const [draft, setDraft] = useState(opened)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<string | undefined>(undefined)
  const [added, setAdded] = useState(0)

  const here = kept(draft)
  const cannot = refusedFor(draft)

  const save = (): void => {
    if (saving || cannot !== null) {
      setRefused(cannot ?? undefined)
      return
    }

    setSaving(true)
    setRefused(undefined)

    Effect.runFork(
      onSave(draft).pipe(
        Effect.catch((cause: unknown) =>
          Effect.sync(() => {
            /*
             * Kept on the screen on refusal, which is the whole reason this is worth
             * having: their own form answers a refusal by reloading the page, and
             * whatever was typed is the one thing here that cannot be fetched again.
             */
            setRefused(cause instanceof Error ? cause.message : String(cause))
            setSaving(false)
          })
        )
      )
    )
  }

  return (
    <>
      <TheBar where={{ kind: "home" }} />
      {/*
        No frame of its own; the shell puts one inset on `#gitquiet-root` for every screen
        at once. Everything below is as wide as that leaves it, which is the first half of
        what was asked for.
      */}
      <div
        className="t-panels flex flex-col gap-1.5 py-3"
        onKeyDown={(event) => {
          // The shortcut every box on GitHub answers, and their own editor does not.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save()
        }}
      >
        <input
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          aria-label="Gist description"
          placeholder="Gist description…"
          className={`h-9 w-full px-3 text-sm ${FIELD}`}
        />

        {here.map((file) => (
          <FileEditor
            key={file.key}
            file={file}
            alone={here.length === 1}
            onName={(name) => setDraft((was) => withFile(was, file.key, (one) => ({ ...one, name })))}
            onContent={(content) =>
              setDraft((was) => withFile(was, file.key, (one) => ({ ...one, content })))
            }
            onRemove={() => setDraft((was) => without(was, file.key))}
          />
        ))}

        {refused === undefined ? null : (
          <p role="alert" className="rounded-md bg-fail-muted px-3 py-2 text-sm">
            {refused}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft((was) => withOneMore(was, `mine-${added}`))
              setAdded((many) => many + 1)
            }}
            className="h-8 rounded-md bg-surface px-3 text-xs"
          >
            Add file
          </button>

          {/*
            Only where their form asks. GitHub has no route to change a gist's visibility
            after it exists, which is the fact the Secret notice on the gist screen is about.
          */}
          {draft.open === null ? null : (
            <>
              <label className="sr-only" htmlFor="gist-visibility">
                Visibility
              </label>
              <select
                id="gist-visibility"
                value={draft.open ? "public" : "secret"}
                onChange={(event) =>
                  setDraft({ ...draft, open: event.target.value === "public" })
                }
                className="h-8 rounded-md bg-raised px-2 text-xs"
              >
                <option value="secret">Secret — anyone with the link</option>
                <option value="public">Public — listed and searchable</option>
              </select>
            </>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="ml-auto h-8 rounded-md bg-accent-emphasis px-3 text-xs text-ink-on-emphasis disabled:opacity-50"
          >
            {saving ? "Saving…" : words}
          </button>
          <a href={back} className="h-8 rounded-md bg-surface px-3 text-xs leading-8">
            Cancel
          </a>
          <button
            type="button"
            onClick={onStepAside}
            className="h-8 rounded-md px-2 text-xs text-ink-muted hover:bg-hover"
          >
            Show GitHub&rsquo;s editor
          </button>
        </div>
      </div>
    </>
  )
}

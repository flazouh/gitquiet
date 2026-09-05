/**
 * A gist being written, in this codebase's words.
 *
 * The thing GitHub's own two forms edit: the one at `gist.github.com/` that makes a gist,
 * and the one at `/{owner}/{id}/edit` that changes one. They are the same shape apart
 * from the visibility choice, which only exists before a gist does — GitHub has no route
 * to make a public gist secret afterwards, and this invents none.
 *
 * See `docs/spec/gists.md`.
 */

/** One file of a gist being written. */
export type DraftFile = {
  /**
   * What this file is called across edits, which is not its name.
   *
   * A reader renaming `a.py` to `b.py` is the same file with a different name, and a
   * list keyed by name would draw it as a file removed and a file added — losing the
   * caret and everything typed since. Never sent to GitHub.
   */
  readonly key: string
  /**
   * GitHub's own id for the content this file had, or empty for one being added.
   *
   * Sent back untouched. It is how their form says which file of the gist this row is,
   * and a file whose oid is not returned reads to them as a new one.
   */
  readonly oid: string
  readonly name: string
  readonly content: string
  /**
   * Whether this file goes when the draft is sent.
   *
   * Marked rather than dropped, because their form deletes a file by sending it back
   * with `delete` set: a file simply left out of the request is a file GitHub keeps.
   * Held out of the way in the screen either way.
   */
  readonly deleted: boolean
}

/** A gist being written, as much of it as the reader decides. */
export type GistDraft = {
  readonly description: string
  /**
   * Whether it is to be public, or nothing where the form does not ask.
   *
   * Only their new-gist form asks. GitHub offers no way to change a gist's visibility
   * after it exists — recorded on Reddit in 2019, and the reason the Secret notice on
   * the gist screen says what it says.
   */
  readonly open: boolean | null
  readonly files: ReadonlyArray<DraftFile>
}

/** The files a reader is actually looking at, which is every one not marked to go. */
export const kept = (draft: GistDraft): ReadonlyArray<DraftFile> =>
  draft.files.filter((file) => !file.deleted)

/** One file changed, by the key that follows it across a rename. */
export const withFile = (
  draft: GistDraft,
  key: string,
  change: (file: DraftFile) => DraftFile
): GistDraft => ({
  ...draft,
  files: draft.files.map((file) => (file.key === key ? change(file) : file))
})

/**
 * One more file, empty and named nothing.
 *
 * Named nothing rather than `gistfile2.txt`, which is GitHub's own placeholder: a name
 * this extension invented would be sent as if the reader had chosen it. Their form
 * refuses a file with no name, which is the right answer to one nobody named.
 */
export const withOneMore = (draft: GistDraft, key: string): GistDraft => ({
  ...draft,
  files: [...draft.files, { key, oid: "", name: "", content: "", deleted: false }]
})

/**
 * One file taken out.
 *
 * A file GitHub has never seen simply goes; one it has is marked, because their form
 * deletes by being told to and not by omission.
 */
export const without = (draft: GistDraft, key: string): GistDraft => ({
  ...draft,
  files: draft.files.flatMap((file) =>
    file.key !== key
      ? [file]
      : file.oid === ""
        ? []
        : [{ ...file, deleted: true }]
  )
})

/**
 * Why this draft cannot be sent, or nothing where it can.
 *
 * Their form answers all three of these too, by reloading the page with the reason at
 * the top — after the reader has lost their place in a textarea. Answering here costs a
 * comparison and keeps the words on the screen.
 */
export const refusedFor = (draft: GistDraft): string | null => {
  const here = kept(draft)
  if (here.length === 0) return "A gist needs at least one file."
  if (here.some((file) => file.name.trim() === "")) return "Every file needs a name."

  const names = here.map((file) => file.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return "Two files cannot share a name."

  return null
}

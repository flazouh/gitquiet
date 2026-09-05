import type { DraftFile, GistDraft } from "../domain/gistEdit"

/**
 * GitHub's own gist form, read off the page so it can be sent back.
 *
 * Both of their forms — the one at `gist.github.com/` that makes a gist and the one at
 * `/{owner}/{id}/edit` that changes one — are `form.js-blob-form`, a Rails form carrying
 * a token signed for this render. So a write from here is that form with the reader's own
 * files in it, exactly as `theirForm.ts` describes for a discussion.
 *
 * Read live, signed in, on 2026-09-06 off both pages. What they carry:
 *
 * ```html
 * <form class="js-blob-form" action="/flazouh/68a8…" method="post">
 *   <input type="hidden" name="_method" value="put">
 *   <input type="hidden" name="authenticity_token" value="…">
 *   <input type="text" name="gist[description]" value="Isen">
 *   <div class="js-gist-file">
 *     <input type="hidden" name="gist[contents][][name]"   value="gistfile1.txt" disabled>
 *     <input type="hidden" name="gist[contents][][oid]"    value="3768a50…"      disabled>
 *     <input type="hidden" name="gist[contents][][value]"  value=""              disabled>
 *     <input type="hidden" name="gist[contents][][delete]" value="true"          disabled>
 *     <input type="hidden" name="gist[contents][][oid]"   value="3768a50…">
 *     <input type="text"   name="gist[contents][][name]"  value="gistfile1.txt">
 *     <textarea            name="gist[contents][][value]">…</textarea>
 *   </div>
 * </form>
 * ```
 *
 * The disabled four are how their own Remove button works: their script enables them and
 * disables the live three, so the file is sent back asking to be deleted rather than
 * left out. A file simply omitted from the request is a file GitHub keeps, which is why
 * {@link sendingGist} sends a deleted one rather than dropping it.
 *
 * Their new-gist form is the same, plus `gist[public]` as a radio pair, and plus three
 * fields whose purpose is to be sent back untouched: `timestamp`, `timestamp_secret`,
 * and a `required_field_…` that must arrive empty. Every one of those is kept by
 * {@link theirs} rather than named here, because a field this file had to know the name
 * of is a field GitHub can rename underneath it.
 */

/** Their own form, and the gist it is already holding. */
export type GistForm = {
  /** Where it posts, as their markup gives it. */
  readonly action: string
  /**
   * Every field of theirs that is not part of the gist itself, in their own order.
   *
   * The token, `_method`, the timestamps, whatever they add next. Sent first and
   * unchanged: this is the half of their form nothing here has an opinion about.
   */
  readonly theirs: ReadonlyArray<readonly [string, string]>
  /** The gist as their form found it, which is what the screen opens on. */
  readonly draft: GistDraft
  /** What their own submit button says, so ours says the same thing. */
  readonly words: string
}

/** Whether an input would be sent by a browser, which a disabled one would not. */
const live = (field: Element): boolean => !field.hasAttribute("disabled")

/** A field's own name, or nothing where it has none — their markup carries nameless ones. */
const nameOf = (field: Element): string => field.getAttribute("name") ?? ""

/** One file, out of the three live fields their file block carries. */
const fileIn = (block: Element, index: number): DraftFile | null => {
  const at = (name: string): Element | null =>
    [...block.querySelectorAll(`[name="gist[contents][][${name}]"]`)].find(live) ?? null

  const name = at("name")
  if (name === null) return null

  return {
    key: `theirs-${index}`,
    oid: at("oid")?.getAttribute("value") ?? "",
    name: name.getAttribute("value") ?? "",
    // Their textarea holds the content as its own text, not as a value attribute.
    content: at("value")?.textContent ?? "",
    deleted: false
  }
}

/**
 * Their form and the gist in it, or nothing where the page carries no such form.
 *
 * Nothing rather than an empty form: a page whose editor cannot be read is a page with
 * nothing to put in front of the reader, and their own form is still under this one.
 */
export const gistFormOn = (page: Document): GistForm | null => {
  const form = page.querySelector("form.js-blob-form")
  const action = form?.getAttribute("action") ?? ""
  if (form === null || action === "") return null

  const description = [...form.querySelectorAll('[name="gist[description]"]')].find(live)
  const open = [...form.querySelectorAll<HTMLInputElement>('input[name="gist[public]"]')].find(
    (radio) => radio.hasAttribute("checked")
  )

  const files = [...form.querySelectorAll(".js-gist-file")]
    .map(fileIn)
    .filter((file): file is DraftFile => file !== null)
  if (files.length === 0) return null

  /*
   * Everything of theirs that is not the gist. Hidden fields and the honeypot, which is
   * a text input wearing `hidden` rather than one of type hidden — so both are asked
   * for. Their own `gist[…]` fields are left out here and written back by `sendingGist`,
   * and a disabled field is left where it is, because a browser would not send one.
   */
  const theirs = [...form.querySelectorAll("input[name]")]
    .filter(
      (field) =>
        live(field) &&
        nameOf(field) !== "" &&
        !nameOf(field).startsWith("gist[") &&
        (field.getAttribute("type") === "hidden" || field.hasAttribute("hidden"))
    )
    .map((field) => [nameOf(field), field.getAttribute("value") ?? ""] as const)

  return {
    action,
    theirs,
    draft: {
      description: description?.getAttribute("value") ?? "",
      open: open === undefined ? null : open.getAttribute("value") === "1",
      files
    },
    words: form.querySelector('button[type="submit"]')?.textContent?.trim() ?? "Save"
  }
}

/**
 * The draft as the body of a POST, in their own form's order.
 *
 * Appended rather than set, because a gist of three files sends `gist[contents][][name]`
 * three times and a body that kept one of each would send a gist of one file.
 *
 * Every file emits the same keys in the same order, `oid` first and empty where GitHub
 * has never seen the file. That is what lets Rails tell one file from the next: it starts
 * a new entry when a key it already has comes round again, so a file that skipped `oid`
 * would have its name and content read as belonging to the file above it.
 */
export const sendingGist = (form: GistForm, draft: GistDraft): string => {
  const body = new URLSearchParams()
  for (const [name, value] of form.theirs) body.append(name, value)

  body.append("gist[description]", draft.description)
  if (draft.open !== null) body.append("gist[public]", draft.open ? "1" : "0")

  for (const file of draft.files) {
    body.append("gist[contents][][oid]", file.oid)
    body.append("gist[contents][][name]", file.name.trim())
    body.append("gist[contents][][value]", file.deleted ? "" : file.content)
    if (file.deleted) body.append("gist[contents][][delete]", "true")
  }

  return body.toString()
}

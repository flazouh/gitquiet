import { Effect } from "effect"
import { useState } from "react"
import { blameAt, blobAt, historyAt, rawAt, rawContentAt } from "../domain/fileAt"
import { useArt } from "./art"
import { GHOST } from "./dress"
import { nameOf } from "./fileIcon"
import { Menu, type Row } from "./Menu"

export type FileAlsoProps = {
  readonly owner: string
  readonly repo: string
  readonly branch: string
  readonly path: string
  /**
   * The head this page was read from, for the permalink.
   *
   * Absent until the front has landed, and the permalink stays off the menu
   * then: a link to `HEAD` is not a permalink.
   */
  readonly head?: string
  /** The file as lines, once it has been read. Nothing to copy until then. */
  readonly lines?: ReadonlyArray<string>
}

const HOLD =
  `${GHOST} grid size-7 shrink-0 place-items-center text-ink-muted no-underline hover:bg-hover hover:text-ink`

/**
 * A word rather than a glyph, for the two their own toolbar spells out.
 *
 * History and Raw are the names a reader looks for. A clock and a document
 * beside four other glyphs is a row of pictures, and the report that asked
 * for these named the words.
 */
const SAID =
  `${GHOST} shrink-0 px-2 py-0.5 text-xs text-ink-muted no-underline hover:bg-hover hover:text-ink`

/**
 * What their file page still owns, on the pane that replaced it.
 *
 * History, Raw, Copy and Download stand on the strip the way they do on
 * GitHub's. The rest — the raw user content host, the blame, the path, the
 * permalink — sit in the menu, which is the shape the report asked for: keep
 * the buttons, even if they hide.
 */
export const FileAlso = ({ owner, repo, branch, path, head, lines }: FileAlsoProps) => {
  const art = useArt()
  const Copy = art.copy
  const Down = art.download
  const More = art.more
  const Tick = art.tick
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<"contents" | "path" | undefined>()

  const at = { owner, repo, on: branch, path }
  const history = historyAt(at)
  const raw = rawAt(at)
  const rawContent = rawContentAt(at)
  const blame = blameAt(at)
  const permalink = head === undefined ? undefined : blobAt({ ...at, on: head })
  const name = nameOf(path)
  const source = lines === undefined ? undefined : lines.join("\n")

  const put = (kind: "contents" | "path", said: string) => {
    Effect.runFork(
      Effect.tryPromise(() => navigator.clipboard.writeText(said)).pipe(
        Effect.match({
          onSuccess: () => setCopied(kind),
          // Refused by a browser that will not give a page the clipboard, and
          // there is nothing to say about it: the file is still on the pane.
          onFailure: () => {}
        })
      )
    )
  }

  const rows: Array<Row> = [
    { name: "Raw user content", where: rawContent, art: "link" },
    { name: "Blame", where: blame, art: "file" },
    {
      name: copied === "path" ? "Path copied" : "Copy path",
      press: () => put("path", path),
      art: "copy"
    }
  ]
  if (permalink !== undefined) rows.push({ name: "Permalink", where: permalink, art: "link" })

  return (
    <div className="flex shrink-0 items-center">
      <a href={history} className={SAID}>
        History
      </a>
      <a href={raw} className={SAID}>
        Raw
      </a>
      {source === undefined ? null : (
        <button
          type="button"
          aria-label={copied === "contents" ? "Copied" : "Copy"}
          title={copied === "contents" ? "Copied" : "Copy"}
          onClick={() => put("contents", source)}
          className={HOLD}
        >
          {copied === "contents" ? <Tick size={14} /> : <Copy size={14} />}
        </button>
      )}
      <a href={raw} download={name} className={HOLD} aria-label="Download" title="Download">
        <Down size={14} />
      </a>
      <div className="relative">
        <button
          type="button"
          aria-label="More"
          aria-expanded={open}
          title="More"
          onClick={() => setOpen((was) => !was)}
          className={HOLD}
        >
          <More size={14} />
        </button>
        <Menu
          name="More"
          origin="top-right"
          wide="w-56"
          open={open}
          onShut={() => setOpen(false)}
          rows={rows}
        />
      </div>
    </div>
  )
}

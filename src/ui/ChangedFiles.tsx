import type { ChangedFile, ChangeType } from "../domain/PullRequest"

export type ChangedFilesProps = {
  readonly files: ReadonlyArray<ChangedFile>
}

/** GitHub's own letters for what happened to a file, in its own three colours. */
const mark: Record<ChangeType, { readonly letter: string; readonly tint: string }> = {
  added: { letter: "A", tint: "text-pass" },
  deleted: { letter: "D", tint: "text-fail" },
  renamed: { letter: "R", tint: "text-ink-muted" },
  copied: { letter: "C", tint: "text-ink-muted" },
  modified: { letter: "M", tint: "text-busy" },
  changed: { letter: "M", tint: "text-busy" }
}

const folderOf = (path: string): string => {
  const cut = path.lastIndexOf("/")
  return cut === -1 ? "" : path.slice(0, cut + 1)
}

const nameOf = (path: string): string => path.slice(folderOf(path).length)

const Row = ({ file }: { readonly file: ChangedFile }) => {
  const { letter, tint } = mark[file.changeType]

  return (
    <li className="flex min-h-8 items-center gap-3 px-4 py-1 hover:bg-hover">
      <span className={`w-3 shrink-0 text-xs font-semibold ${tint}`} title={file.changeType}>
        {letter}
      </span>
      {/* The folder is greyed and the file is not, so a list of twenty paths
          reads as twenty files rather than twenty prefixes. */}
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="text-ink-muted">{folderOf(file.path)}</span>
        {nameOf(file.path)}
      </span>
      <span className="shrink-0 text-xs tabular-nums">
        <span className="text-pass">+{file.linesAdded}</span>{" "}
        <span className="text-fail">−{file.linesDeleted}</span>
      </span>
    </li>
  )
}

export const ChangedFiles = ({ files }: ChangedFilesProps) =>
  files.length === 0 ? (
    <p className="px-4 py-2.5 text-sm text-ink-muted">No files changed</p>
  ) : (
    <ul className="Box py-1">
      {files.map((file) => (
        <Row key={file.path} file={file} />
      ))}
    </ul>
  )

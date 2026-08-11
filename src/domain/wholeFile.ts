import { Option } from "effect"

/**
 * A whole file as a patch, which is what the diff renderer reads.
 *
 * There is no second renderer for plain files and there should not be one. The
 * one this extension already ships is the thing that knows the reader's theme,
 * their font size, whether long lines wrap, and how a line number is drawn, and
 * a file drawn by anything else would agree with none of it. A file nothing has
 * happened to is a patch whose every line is context, so that is what this
 * writes.
 *
 * Nothing for an empty file. A patch with no lines renders as a blank panel,
 * which reads as a failure; the pane says the file is empty instead, in words.
 */
export const wholeFile = (path: string, lines: ReadonlyArray<string>): Option.Option<string> => {
  if (lines.length === 0) return Option.none()

  return Option.some(
    [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      `@@ -1,${lines.length} +1,${lines.length} @@`,
      // The leading space is what marks a line as context. A line of the file
      // that is itself empty becomes a line holding only that space.
      ...lines.map((line) => ` ${line}`),
      ""
    ].join("\n")
  )
}

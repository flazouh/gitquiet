/**
 * Which vocabulary reads a file, decided by the name it is written under.
 *
 * The same question `src/ledger/parse.ts` answers about grammars, asked about
 * the other half: a grammar turns text into a tree, and a Dialect is what the
 * node types in that tree mean. They are chosen by the same extension and they
 * are chosen apart, because a grammar with no Dialect parses a file nobody can
 * ask a question about — which is what every language but these was until now,
 * and is worth being able to say rather than worth crashing over.
 *
 * A path with no Dialect is not a failure. It is a file the reader gets no
 * underline on, which is exactly what a `.md` file gets and always did.
 */

import type { Dialect } from "./writings"
import { GO } from "./dialects/go"
import { PYTHON } from "./dialects/python"
import { RUST } from "./dialects/rust"
import { TYPESCRIPT } from "./dialects/typescript"

/** The vocabularies, by the extensions people write them in. */
const DIALECTS: Readonly<Record<string, Dialect>> = {
  ts: TYPESCRIPT,
  mts: TYPESCRIPT,
  cts: TYPESCRIPT,
  tsx: TYPESCRIPT,
  js: TYPESCRIPT,
  mjs: TYPESCRIPT,
  cjs: TYPESCRIPT,
  jsx: TYPESCRIPT,
  py: PYTHON,
  pyi: PYTHON,
  go: GO,
  rs: RUST
}

/**
 * The Dialect for a path, or nothing where no language here reads it.
 *
 * Reads the last dot of the last segment, so `a.b/c` is not an extension and
 * `Component.test.tsx` is `tsx` rather than `test.tsx`.
 */
export const dialectFor = (path: string): Dialect | null => {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return null
  return DIALECTS[name.slice(dot + 1).toLowerCase()] ?? null
}

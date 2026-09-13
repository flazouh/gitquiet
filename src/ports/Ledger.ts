/**
 * Where a name is written, said without a parser anywhere in sight.
 *
 * The interface asks these three questions and never asks what answers them.
 * Inside the extension it is a Tree-sitter grammar in the offscreen document,
 * because that is the one place at our own origin where WebAssembly may be
 * compiled — see `src/diff/shiki.ts` and `plans/009-can-a-grammar-compile-at-all.md`.
 * On a desktop build it could be a language server on a real filesystem, which
 * would answer the same three questions and be Sure about far more of them. The
 * screens cannot tell the difference, which is the point of a port.
 *
 * `docs/spec/following.md` has the words: Name, Writing, Uses, Follow, Sure,
 * Likely, Ledger.
 */

import { Data, type Effect, type Option } from "effect"
import type { Place } from "../ledger/ledger"
import type { Found as AcrossUse } from "../ledger/uses"
import type { Borrowed, Use, Writing } from "../ledger/writings"

export type { Place } from "../ledger/ledger"
/**
 * One Use across a repository, renamed on the way through.
 *
 * `Found` is taken here by the two-kinds answer to where a Name is written, and
 * a port with two of them is a port where a reader has to check which one a
 * signature means.
 */
export type { Found as AcrossUse } from "../ledger/uses"
export type { Borrowed, Found, Use, Writing, WritingKind } from "../ledger/writings"

/**
 * A file to be asked about: its path, and the text of it.
 *
 * The text rather than a way to fetch it, because every screen that can ask has
 * it already — it is the thing on the reader's screen. What a Ledger does with
 * it is a Ledger's business; what it must not do is fetch a second copy of a
 * file the caller is looking at.
 */
export type Reading = {
  /** Which decides the language, and nothing else here reads it. */
  readonly path: string
  readonly text: string
  /**
   * What this text is, for keeping a parse under.
   *
   * A blob sha where the caller knows one, which is most of them: git already
   * names a file's contents, and two branches holding the same file are the
   * same parse. Absent where nothing knows, and then the text itself decides.
   */
  readonly key?: string
}

/** Tree-sitter's own coordinates, and the renderer's: both zero-based. */
export type Spot = { readonly row: number; readonly column: number }

/**
 * Where a Name is written: here, or in a file this one borrowed it from.
 *
 * Two kinds of answer because there are two, and a port that flattened them
 * would be a port that lost the only thing a caller can act on — an `elsewhere`
 * is not a dead end, it is a second question with the answer to it in hand.
 */
export type Where =
  | { readonly at: "here"; readonly writing: Writing }
  | { readonly at: "elsewhere"; readonly borrowed: Borrowed }

export type Ledger = {
  /** Where the Name at a spot is written, or nothing — which is a real answer. */
  readonly writingAt: (
    reading: Reading,
    at: Spot
  ) => Effect.Effect<Option.Option<Where>, LedgerUnavailable>
  /**
   * The Writing this file gives a name, for a file that borrowed it.
   *
   * The other half of Following across files: one file says where it read a
   * name from, and this is what that file is asked.
   */
  readonly writingNamed: (
    reading: Reading,
    name: string
  ) => Effect.Effect<Option.Option<Writing>, LedgerUnavailable>
  /** Everywhere in this file that means the same Writing. */
  readonly usesIn: (
    reading: Reading,
    writing: Writing
  ) => Effect.Effect<ReadonlyArray<Use>, LedgerUnavailable>
  /** The Writings the file holds, in the order they are written. The outline. */
  readonly writingsIn: (
    reading: Reading
  ) => Effect.Effect<ReadonlyArray<Writing>, LedgerUnavailable>
  /**
   * Reads the whole repository at a commit, so the questions one file cannot
   * answer can be.
   *
   * Asked for rather than done on arrival: it is one large request and most
   * reading never needs it. What it answers with is how it went, so a screen can
   * say "nothing here parses" rather than leaving a box empty.
   */
  readonly warm: (repo: Repo, sha: string) => Effect.Effect<Warmth, LedgerUnavailable>
  /** Every Writing in the repository whose name the typing names, best first. */
  readonly namesLike: (
    repo: Repo,
    sha: string,
    query: string,
    most?: number
  ) => Effect.Effect<Places, LedgerUnavailable>
  /**
   * Everywhere in the repository that means one Writing.
   *
   * The question a file cannot answer about itself. Needs a Ledger, and says so
   * rather than answering with the little it could see: an empty list and a
   * list that has not been read are different things to a reader deciding
   * whether a name is safe to change.
   */
  readonly usesAcross: (
    repo: Repo,
    sha: string,
    asked: { readonly name: string; readonly path: string; readonly line: number },
    most?: number
  ) => Effect.Effect<Across, LedgerUnavailable>
}

/** Which repository, said the way every other port here says it. */
export type Repo = { readonly owner: string; readonly repo: string }

/** How a warm went: how many files were read, or why none were. */
export type Warmth = {
  readonly ready: boolean
  readonly read?: number
  readonly skipped?: number
  readonly why?: string
}

/** Uses across a repository, and whether there is a Ledger to have found them in. */
export type Across = {
  readonly uses: ReadonlyArray<AcrossUse>
  readonly ready: boolean
}

/** Writings across a repository, and whether there is a Ledger to have found them in. */
export type Places = {
  readonly places: ReadonlyArray<Place>
  readonly ready: boolean
}

/**
 * Nothing could answer, which is not the same as nothing to say.
 *
 * A language no grammar here parses, a document that would not open, a browser
 * that refused the chunk. All of them leave the file exactly as it reads today —
 * no underline, no card — which is why this is one failure and not four: the
 * interface does the same thing for every one of them, and a reader is told
 * nothing at all rather than told that a thing they never asked for did not work.
 */
export class LedgerUnavailable extends Data.TaggedError("LedgerUnavailable")<{
  readonly cause: unknown
}> {}

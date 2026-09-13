/**
 * The Ledger as the interface has it: a message, and an answer.
 *
 * The page cannot compile a grammar, so it asks the worker, which wakes the
 * offscreen document, which parses. Three hops for a question that must feel
 * like none — and it does, because the answer to a Name is a few milliseconds
 * of parsing and the hops are all within one process's messaging.
 *
 * Every failure lands in the same place: `LedgerUnavailable`, which the screens
 * answer by drawing nothing at all. A reader who never held Command is on the
 * screen that exists today, and a reader who did and got nothing is on the same
 * one. That is the whole of the error handling, and it is deliberate.
 */

import { Effect, Option } from "effect"
import {
  LEDGER_ASK,
  LEDGER_ACROSS,
  LEDGER_NAMES,
  LEDGER_WARM,
  isLedgerAnswer,
  type LedgerAsk,
  type LedgerAcross,
  type LedgerAcrossAsk,
  type LedgerNames,
  type LedgerPlaces,
  type LedgerWarm,
  type LedgerWarmth,
  type Question
} from "./protocol"
import {
  LedgerUnavailable,
  type Ledger,
  type Reading,
  type Spot
} from "../ports/Ledger"
import type { Use, Writing } from "./writings"
import type { Where } from "../ports/Ledger"

/** Whatever carries a message to the worker. Named so a test can be one. */
export type Post = (message: unknown) => PromiseLike<unknown>

const asked = (post: Post, reading: Reading, question: Question) =>
  Effect.tryPromise({
    try: () =>
      post({
        kind: LEDGER_ASK,
        path: reading.path,
        text: reading.text,
        ...(reading.key === undefined ? {} : { key: reading.key }),
        question
      } satisfies LedgerAsk),
    catch: (cause) => new LedgerUnavailable({ cause })
  }).pipe(
    Effect.flatMap((answer) =>
      isLedgerAnswer(answer)
        ? Effect.succeed(answer)
        : Effect.fail(new LedgerUnavailable({ cause: "the worker answered with nothing" }))
    )
  )

export const ledgerThrough = (post: Post): Ledger => ({
  writingAt: (reading: Reading, at: Spot) =>
    asked(post, reading, { of: "writingAt", at }).pipe(
      Effect.map((answer): Option.Option<Where> => {
        if (answer.borrowed !== undefined) {
          return Option.some({ at: "elsewhere", borrowed: answer.borrowed })
        }
        return answer.writing === null || answer.writing === undefined
          ? Option.none()
          : Option.some({ at: "here", writing: answer.writing })
      })
    ),
  writingNamed: (reading: Reading, name: string) =>
    asked(post, reading, { of: "writingNamed", name }).pipe(
      Effect.map((answer) => Option.fromNullishOr(answer.writing))
    ),
  usesIn: (reading: Reading, writing: Writing) =>
    asked(post, reading, { of: "usesIn", writing }).pipe(
      Effect.map((answer): ReadonlyArray<Use> => answer.uses ?? [])
    ),
  writingsIn: (reading: Reading) =>
    asked(post, reading, { of: "writingsIn" }).pipe(
      Effect.map((answer): ReadonlyArray<Writing> => answer.writings ?? [])
    ),
  warm: (repo, sha) =>
    Effect.tryPromise({
      try: () =>
        post({ kind: LEDGER_WARM, owner: repo.owner, repo: repo.repo, sha } satisfies LedgerWarm),
      catch: (cause) => new LedgerUnavailable({ cause })
    }).pipe(
      Effect.map((answer) => (answer ?? { ready: false }) as LedgerWarmth)
    ),
  namesLike: (repo, sha, query, most) =>
    Effect.tryPromise({
      try: () =>
        post({
          kind: LEDGER_NAMES,
          owner: repo.owner,
          repo: repo.repo,
          sha,
          query,
          ...(most === undefined ? {} : { most })
        } satisfies LedgerNames),
      catch: (cause) => new LedgerUnavailable({ cause })
    }).pipe(
      Effect.map((answer) => (answer ?? { places: [], ready: false }) as LedgerPlaces)
    ),
  usesAcross: (repo, sha, asked, most) =>
    Effect.tryPromise({
      try: () =>
        post({
          kind: LEDGER_ACROSS,
          owner: repo.owner,
          repo: repo.repo,
          sha,
          name: asked.name,
          path: asked.path,
          line: asked.line,
          ...(most === undefined ? {} : { most })
        } satisfies LedgerAcrossAsk),
      catch: (cause) => new LedgerUnavailable({ cause })
    }).pipe(
      Effect.map((answer) => (answer ?? { uses: [], ready: false }) as LedgerAcross)
    )
})

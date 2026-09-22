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

import { Effect, Option, Schedule } from "effect"
import {
  LEDGER_ASK,
  LEDGER_ACROSS,
  LEDGER_BEYOND,
  LEDGER_NAMES,
  LEDGER_READY,
  LEDGER_WARM,
  isLedgerAnswer,
  type LedgerAsk,
  type LedgerAcross,
  type LedgerAcrossAsk,
  type LedgerBeyond,
  type LedgerFound,
  type LedgerNames,
  type LedgerPlaces,
  type LedgerReady,
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

/**
 * How many times a question is put again before it is given up on.
 *
 * The worker this talks to is a service worker, and a service worker sleeps.
 * Waking one is Chrome's job and usually finishes before the message lands,
 * but the two race: a `sendMessage` sent into a worker that is still starting
 * comes back "Could not establish connection. Receiving end does not exist",
 * which is not an answer about a Name, it is the question arriving too early.
 *
 * Measured: one of these in five filmed runs on a live pull request, and none
 * in eight after. A rate like that is exactly the kind a reader hits on the one
 * morning they are showing somebody, so it is worth three attempts and 150ms
 * rather than a shrug.
 *
 * Only the sending is retried. A worker that answered with something this does
 * not recognise answered, and asking it again gets the same answer more slowly.
 */
const WAKING = 2
const WAKING_WAIT = "50 millis"

const asked = (post: Post, reading: Reading, question: Question) =>
  Effect.tryPromise({
    try: () =>
      post({
        kind: LEDGER_ASK,
        path: reading.path,
        text: reading.text,
        ...(reading.key === undefined ? {} : { key: reading.key }),
        ...(reading.repo === undefined
          ? {}
          : { owner: reading.repo.owner, repo: reading.repo.repo }),
        ...(reading.sha === undefined ? {} : { sha: reading.sha }),
        question
      } satisfies LedgerAsk),
    catch: (cause) => new LedgerUnavailable({ cause })
  }).pipe(
    Effect.retry({ times: WAKING, schedule: Schedule.spaced(WAKING_WAIT) }),
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
          return Option.some({
            at: "elsewhere",
            borrowed: answer.borrowed,
            ...(answer.orFrom === undefined ? {} : { orFrom: answer.orFrom })
          })
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
  borrowedAs: (reading: Reading, name: string) =>
    asked(post, reading, { of: "borrowedAs", name }).pipe(
      Effect.map((answer) =>
        answer.borrowed === undefined
          ? Option.none()
          : Option.some({
              at: "elsewhere" as const,
              borrowed: answer.borrowed,
              ...(answer.orFrom === undefined ? {} : { orFrom: answer.orFrom })
            })
      )
    ),
  usesIn: (reading: Reading, writing: Writing) =>
    asked(post, reading, { of: "usesIn", writing }).pipe(
      Effect.map((answer): ReadonlyArray<Use> => answer.uses ?? [])
    ),
  writingsIn: (reading: Reading) =>
    asked(post, reading, { of: "writingsIn" }).pipe(
      Effect.map((answer): ReadonlyArray<Writing> => answer.writings ?? [])
    ),
  ready: (path) =>
    Effect.tryPromise({
      try: () => post({ kind: LEDGER_READY, path } satisfies LedgerReady),
      catch: (cause) => new LedgerUnavailable({ cause })
    }).pipe(Effect.asVoid),
  warm: (repo, sha, exact) =>
    Effect.tryPromise({
      try: () =>
        post({
          kind: LEDGER_WARM,
          owner: repo.owner,
          repo: repo.repo,
          sha,
          ...(exact === undefined ? {} : { exact })
        } satisfies LedgerWarm),
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
  beyond: (repo, sha, specifier, name, registry) =>
    Effect.tryPromise({
      try: () =>
        post({
          kind: LEDGER_BEYOND,
          owner: repo.owner,
          repo: repo.repo,
          sha,
          specifier,
          name,
          ...(registry === undefined ? {} : { registry })
        } satisfies LedgerBeyond),
      catch: (cause) => new LedgerUnavailable({ cause })
    }).pipe(Effect.map((answer) => (answer ?? { why: "nothing answered" }) as LedgerFound)),
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
          ...(asked.column === undefined ? {} : { column: asked.column }),
          ...(most === undefined ? {} : { most })
        } satisfies LedgerAcrossAsk),
      catch: (cause) => new LedgerUnavailable({ cause })
    }).pipe(
      Effect.map((answer) => (answer ?? { uses: [], ready: false }) as LedgerAcross)
    )
})

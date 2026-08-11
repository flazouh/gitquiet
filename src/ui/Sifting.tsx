import { Effect, Fiber, Option } from "effect"
import { useEffect, useState } from "react"
import type { Participant } from "../domain/PullRequest"
import { authorIn, byAuthor, type CommitList, sinceIn, sinceWhen } from "../domain/commitList"
import { useArt } from "./art"
import { PRESSABLE } from "./dress"
import { Menu, type Row } from "./Menu"

/**
 * The way a screen reads everybody who has written a commit here.
 *
 * The kept list first, so the filter opens full on every visit after the first,
 * then GitHub's answer behind it.
 */
export type LoadAuthors = (
  partly: (authors: ReadonlyArray<Participant>) => void
) => Effect.Effect<ReadonlyArray<Participant>, unknown>

/**
 * A control that names what it is narrowed to, and opens a menu to change it.
 *
 * The shape both filters share: their own page has three of these in a row, and
 * two of them here differ only in what fills the menu.
 */
const Sifter = ({
  name,
  said,
  narrowed,
  rows,
  find,
  onOpen
}: {
  /** What the control is for, read to somebody who cannot see the row. */
  readonly name: string
  /** What it is narrowed to, or the word for narrowed to nothing. */
  readonly said: string
  /** Whether it is narrowed at all, which is the difference the eye needs. */
  readonly narrowed: boolean
  readonly rows: ReadonlyArray<Row>
  readonly find?: string
  readonly onOpen?: () => void
}) => {
  const [open, setOpen] = useState(false)
  const Down = useArt()["chevron-down"]

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${name}: ${said}`}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 py-1 text-sm hover:bg-active ${PRESSABLE} ${
          narrowed ? "text-ink" : "text-ink-muted"
        }`}
        onClick={() => {
          onOpen?.()
          setOpen((was) => !was)
        }}
      >
        <span>{said}</span>
        <Down size={12} className="text-ink-muted" />
      </button>
      <Menu
        name={name}
        open={open}
        onShut={() => setOpen(false)}
        rows={rows}
        origin="top-left"
        wide="w-64"
        find={find}
      />
    </div>
  )
}

/**
 * Whose commits the page is showing.
 *
 * `All users` when it is showing everybody's, which is their own word for it and
 * the state the page arrives in. Nothing is read until the control is opened:
 * the repository's contributor list is twelve kilobytes and most readers never
 * narrow by person.
 */
export const Authors = ({
  list,
  load,
  onGo
}: {
  readonly list: CommitList
  readonly load?: LoadAuthors
  /** How to go there; see the same argument on the branch picker. */
  readonly onGo: (path: string) => void
}) => {
  const [asked, setAsked] = useState(false)
  const [people, setPeople] = useState<ReadonlyArray<Participant>>([])
  const on = authorIn(list)

  useEffect(() => {
    if (!asked || load === undefined) return

    let watching = true
    const reading = Effect.runFork(
      load((found) => {
        if (watching) setPeople(found)
      }).pipe(
        Effect.map((found) => {
          if (watching) setPeople(found)
        }),
        // A filter that cannot read the people is a filter offering only the way
        // back to everybody, which is the row that matters most anyway.
        Effect.orElseSucceed(() => {})
      )
    )

    return () => {
      watching = false
      Effect.runFork(Fiber.interrupt(reading))
    }
  }, [asked, load])

  const rows: ReadonlyArray<Row> = [
    everybody(list, onGo, Option.isNone(on)),
    ...people.map((person) => {
      const where = byAuthor(list, Option.some(person.login))
      return {
        name: person.login,
        where,
        press: () => onGo(where),
        chosen: Option.contains(on, person.login)
      }
    })
  ]

  return (
    <Sifter
      name="Author"
      said={Option.getOrElse(on, () => EVERYBODY)}
      narrowed={Option.isSome(on)}
      rows={rows}
      find="Find a person"
      onOpen={() => setAsked(true)}
    />
  )
}

/** The row that takes the filter off, which is the one row every reader needs. */
const everybody = (list: CommitList, onGo: (path: string) => void, chosen: boolean): Row => {
  const where = byAuthor(list, Option.none())
  return { name: EVERYBODY, where, press: () => onGo(where), chosen }
}

/** Their own word for the filter being off, kept so the control reads as theirs does. */
const EVERYBODY = "All users"

/** The same, for the dates. */
const EVER = "All time"

/**
 * How far back the page goes.
 *
 * Ranges rather than a calendar. Their picker offers two dates and the question
 * a reader actually has is "what landed this week", which a calendar answers by
 * making them work out today's date and count backwards. The address is theirs
 * either way — `since` is a day — so a page reached from their picker, or typed,
 * still reads correctly here.
 */
export const Dates = ({
  list,
  onGo
}: {
  readonly list: CommitList
  /** How to go there; see the same argument on the branch picker. */
  readonly onGo: (path: string) => void
}) => {
  const on = sinceIn(list)
  const ever = sinceWhen(list, Option.none())

  const rows: ReadonlyArray<Row> = [
    { name: EVER, where: ever, press: () => onGo(ever), chosen: Option.isNone(on) },
    ...SPANS.map(({ said, days }) => {
      const day = dayBefore(days)
      const where = sinceWhen(list, Option.some(day))
      return { name: said, where, press: () => onGo(where), chosen: Option.contains(on, day) }
    })
  ]

  return (
    <Sifter
      name="Since"
      said={Option.match(on, { onNone: () => EVER, onSome: (day) => `Since ${day}` })}
      narrowed={Option.isSome(on)}
      rows={rows}
    />
  )
}

const SPANS = [
  { said: "The last week", days: 7 },
  { said: "The last month", days: 30 },
  { said: "The last three months", days: 90 },
  { said: "The last year", days: 365 }
] as const

/**
 * The day some number of days ago, written the way their filter takes it.
 *
 * Local rather than UTC. A reader in Paris asking for the last week at one in
 * the morning means the seven days they have lived through, and `toISOString`
 * would hand back the day before.
 */
const dayBefore = (days: number): string => {
  const day = new Date()
  day.setDate(day.getDate() - days)

  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
}

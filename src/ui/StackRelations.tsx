import type { Piled } from "../domain/sittings"

export type FlatPile = {
  readonly pile: Piled
  readonly parent?: Piled
}

export const flattenPile = (pile: Piled, parent?: Piled): ReadonlyArray<FlatPile> => [
  { pile, parent },
  ...pile.above.flatMap((higher) => flattenPile(higher, pile))
]

type Family = {
  readonly base: number
  readonly children: ReadonlyArray<number>
  readonly lane: 12 | 20
}

const ROW_HEIGHT = 33
const ROW_MIDDLE = ROW_HEIGHT / 2
const BASE_EDGE = 28
const CHILD_EDGE = 44
const ELBOW = 6

const middleOf = (row: number): number => row * ROW_HEIGHT + ROW_MIDDLE

const familiesIn = (rows: ReadonlyArray<FlatPile>): ReadonlyArray<Family> => {
  const rowOf = new Map(rows.map(({ pile }, row) => [pile, row] as const))
  const childrenOf = new Map<number, Array<number>>()

  for (const [child, { parent }] of rows.entries()) {
    if (parent === undefined) continue
    const base = rowOf.get(parent)
    if (base === undefined) continue
    const children = childrenOf.get(base) ?? []
    children.push(child)
    childrenOf.set(base, children)
  }

  let previous: Family | undefined
  return [...childrenOf.entries()].map(([base, children]) => {
    const previousLast = previous?.children.at(-1)
    const lane = previousLast !== undefined && previousLast >= base ? 12 : 20
    const family: Family = { base, children, lane }
    previous = family
    return family
  })
}

const familyPath = ({ base, children, lane }: Family): string => {
  const baseY = middleOf(base)
  const lastY = middleOf(children.at(-1) ?? base)
  const trunk = `M${BASE_EDGE} ${baseY} H${lane + ELBOW} Q${lane} ${baseY} ${lane} ${baseY + ELBOW} V${lastY - ELBOW}`
  const arms = children.map((child) => {
    const childY = middleOf(child)
    return `M${CHILD_EDGE} ${childY} H${lane + ELBOW} Q${lane} ${childY} ${lane} ${childY - ELBOW}`
  })
  return [trunk, ...arms].join(" ")
}

export const StackRelations = ({ rows }: { readonly rows: ReadonlyArray<FlatPile> }) => {
  const families = familiesIn(rows)

  return (
    <svg
      data-stack-relations=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-visible text-ink-accent"
      width="100%"
      height={rows.length * ROW_HEIGHT}
    >
      {families.map((family) => {
        const baseY = middleOf(family.base)
        return (
          <g
            key={`${family.base}:${family.children.join(",")}`}
            data-stack-family=""
            data-lane={family.lane}
          >
            <path
              d={familyPath(family)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              data-stack-arrow=""
              d={`M23 ${baseY - 2} L28 ${baseY} L23 ${baseY + 2} Z`}
              fill="currentColor"
            />
          </g>
        )
      })}
    </svg>
  )
}

import type { Court } from "../../domain/workingSet"
import { useArt } from "../art"
import { COURT_ART, COURT_MEANS, COURT_NAME } from "../courts"

/** The order the list draws them in, which is the order whose move it is. */
const ORDER: ReadonlyArray<Court> = ["your-move", "waiting", "running", "settled"]

/**
 * The four groups, named and explained, which is the whole of what a reader has to
 * learn to read this product.
 *
 * Names and meanings from `courts.ts`, the same two tables the list's own headings
 * read. Nothing here is written for the occasion, so the words a reader is taught are
 * the words they will see.
 *
 * They arrive one after another, sixty milliseconds apart, in CSS rather than in a
 * motion library: this is drawn on a page, in a window and in an extension, and only
 * one of the three carries one.
 */
export const Courts = () => {
  const art = useArt()

  return (
    <dl className="tour-courts">
      {ORDER.map((court, at) => {
        const Glyph = art[COURT_ART[court]]

        return (
          <div key={court} className="tour-court" style={{ animationDelay: `${at * 60}ms` }}>
            <Glyph size={15} className="tour-court-art" />
            <dt className="tour-court-name">{COURT_NAME[court]}</dt>
            <dd className="tour-court-means">{COURT_MEANS[court]}</dd>
          </div>
        )
      })}
    </dl>
  )
}

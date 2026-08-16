import { COURTS } from "../../domain/attention"
import { useArt } from "../art"
import { COURT_ART, COURT_MEANS, COURT_NAME } from "../courts"

/**
 * The four groups, named and explained, which is the whole of what a reader has to
 * learn to read this product.
 *
 * The order, the names and the meanings all come from where the list itself reads
 * them — `attention.ts` and `courts.ts`. Nothing here is written for the occasion, so
 * the words a reader is taught are the words they will see, in the order they will see
 * them in.
 *
 * They arrive one after another, sixty milliseconds apart, in CSS rather than in a
 * motion library: this is drawn on a page and in a window, and only one of the two
 * carries one.
 */
export const Courts = () => {
  const art = useArt()

  return (
    <dl className="tour-courts">
      {COURTS.map((court, at) => {
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

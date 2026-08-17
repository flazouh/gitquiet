import { useArt } from "./art"
import { Section } from "./Section"

/**
 * What stands where the merge card would, when GitHub would not serve the merge box.
 *
 * A card and not a gap. A gap is read as "there is nothing to decide here", which is
 * the one thing this cannot say: whether this can land is exactly what nobody knows.
 * So it keeps the box's place in the column, wears the box's name, and spends its
 * sentences saying which fact is missing and what will bring it back.
 *
 * No buttons, greyed or otherwise. Every verb the live card offers is offered on the
 * strength of something the merge box said — that GitHub would take a merge, that
 * there is a queue to join, that the branch is behind — and a control that cannot say
 * why it is refusing is worse than no control at all. No press of its own either:
 * `useLive` reads this pull request again whenever the tab comes back to the front,
 * and a second way to ask for the same read would be a second answer to one question.
 *
 * The pull request around it is untouched. The diff, the checks, the conversation and
 * the commits come from other routes, and a reader who came to read the change can
 * still read it.
 *
 * Its own file rather than a fourth panel inside `Merge.tsx`, which is within a few
 * lines of a thousand. Nothing here belongs to that card: it draws no merge state, it
 * offers no verb, and the only reason it wears the same name is that it stands in the
 * same place.
 */
export const MergeUnread = () => {
  const Alert = useArt()["check-failed"]

  return (
    <Section
      name="Merge"
      summary={
        <span className="flex items-center gap-1.5">
          <Alert size={12} className="text-ink-muted" />
          not known
        </span>
      }
    >
      <p className="px-3 py-2 text-xs leading-snug text-ink-muted">
        GitHub did not answer for this one, so whether it can land, what is holding it
        up and where it sits in a queue are all unknown. Nothing here is a no. It is the
        question going unanswered, and the next read of this page asks it again.
      </p>
    </Section>
  )
}

import { useState } from "react"
import { Markdown } from "./Markdown"
import { Section } from "./Section"

/**
 * What the Author wrote: the first screenful of it, and the rest on a click.
 *
 * A fold that says nothing is a fold nobody opens, so the top of the
 * description is always on the page — enough to see what kind of thing this is
 * — with a fade at the cut to say the words carry on. Kept to a height rather
 * than shown whole because a three-hundred-line description would put CI and
 * the conversation a screen below the fold, and those are what a reviewer came
 * for.
 *
 * Opened, the ceiling goes altogether: all of it, at whatever length it was
 * written, with the page scrolling rather than a box inside the card. Asking
 * for the whole of something and being given a second, smaller window onto it
 * is the thing this used to get wrong.
 */
export const Description = ({ html }: { readonly html: string }) => {
  const [whole, setWhole] = useState(false)

  return (
    <Section name="Description">
      <div className="relative">
        <div
          className={`px-3 py-3 ${whole ? "" : "overflow-hidden"}`}
          style={whole ? undefined : { maxHeight: "13rem" }}
        >
          <Markdown html={html} />
        </div>
        {whole ? null : (
          // Over the last of the text rather than under it: the fade is what
          // says the words carry on, and a gap between the two would read as
          // the description simply ending there.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--bgColor-default))"
            }}
          />
        )}
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          className="text-xs text-ink-accent hover:underline"
          onClick={() => setWhole((open) => !open)}
        >
          {whole ? "Show less" : "Show all of it"}
        </button>
      </div>
    </Section>
  )
}

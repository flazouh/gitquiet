import { useState, type ReactNode } from "react"

/**
 * The first screenful of something long, and the rest on a press.
 *
 * A fold that says nothing is a fold nobody opens, so the top is always on the page — enough to
 * see what kind of thing this is — with a fade at the cut to say the words carry on. Kept to a
 * height rather than shown whole because a three-hundred-line body puts everything after it a
 * screen below the fold, and on a discussion that is the answer.
 *
 * Opened, the ceiling goes altogether: all of it, at whatever length it was written, with the
 * page scrolling rather than a box inside the card. Asking for the whole of something and being
 * given a second, smaller window onto it is the thing this used to get wrong.
 *
 * Its own file because two screens fold now. A pull request's description folds markdown this
 * codebase parsed, and a discussion's body folds the article GitHub rendered, so the fold cannot
 * live with either of the two things it folds.
 */
export const Folded = ({
  children,
  foldable = true
}: {
  readonly children: ReactNode
  readonly foldable?: boolean
}) => {
  const [opened, setOpened] = useState(false)
  const whole = !foldable || opened

  return (
    <>
      {/*
       * The cut is made by fading the words themselves rather than by laying a panel-coloured
       * pane over them. A pane has to know what colour it is standing on, and it was wrong
       * wherever that colour was not the page's — a dark rectangle across the bottom of a
       * lighter card. A mask carries no colour at all, so it is right on every surface this
       * ever lands on.
       */}
      <div
        className={`px-3 py-3 ${whole ? "" : "overflow-hidden"}`}
        style={
          whole
            ? undefined
            : {
                maxHeight: "13rem",
                maskImage: "linear-gradient(to bottom, #000 calc(100% - 3rem), transparent)",
                WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 3rem), transparent)"
              }
        }
      >
        {children}
      </div>
      {foldable ? (
        <div className="px-3 pb-2">
          <button
            type="button"
            className="text-xs text-ink-accent hover:underline"
            onClick={() => setOpened((open) => !open)}
          >
            {whole ? "Show less" : "Show all of it"}
          </button>
        </div>
      ) : null}
    </>
  )
}

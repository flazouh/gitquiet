/**
 * A colour for a label, worked out from its own name.
 *
 * GitHub keeps a colour for every label and does not send it on the route these issues are read
 * from — the search answers with the words and nothing else. Fetching them would mean a request
 * per repository for a dot, so the name is the seed instead: the same word is always the same
 * hue, and `bug` looks like `bug` on every row of every repository in the list. It will not be
 * the hue GitHub shows on their own page, and that is the honest trade — what the dot is for is
 * telling two labels apart at a glance, which a shared grey cannot do.
 *
 * Held to one lightness and one saturation, both chosen against this interface's dark surface,
 * so a wall of them stays a row of quiet dots rather than a fruit bowl. Colour is never the only
 * carrier: the word is right beside it.
 */
export const toneOf = (word: string): string => {
  let hash = 0
  for (const letter of word) {
    // Rotate before adding, so `bug` and `gub` are not the same colour. The multiplier is the
    // usual small odd prime; nothing here depends on the exact number, only on it being stable.
    //
    // Wrapped to 32 bits and taken round the circle at the end rather than at every letter.
    // Folding into 360 as it went threw away the bits that tell words apart, and `bug` and
    // `enhancement` came out the same colour.
    hash = (hash * 31 + letter.codePointAt(0)!) | 0
  }

  return `hsl(${Math.abs(hash) % 360} 52% 62%)`
}

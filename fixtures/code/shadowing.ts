import { elsewhere } from "./elsewhere"
import Whole, { two as three } from "./whole"

/**
 * What the outer one is for.
 *
 * Two sentences, so the card has something to cut.
 */
export const shape = (given: string, over = 1): number => {
  const inner = given.length
  return inner + over + shape.length
}

function said(word: string) {
  // The same name as the outer one, and a different thing entirely.
  const shape = word.trim()
  return shape + shape
}

export type Held = { readonly name: string }

class Thing {
  private held = 1

  method(arg: number) {
    return this.held + arg
  }
}

for (const each of [1, 2]) {
  said(String(each))
}

const { picked, ...rest } = { picked: 1 }
const [first] = [1]

export const later = () => early()
function early() {
  return elsewhere(Whole, three, picked, rest, first)
}

const used = new Thing()
shape("x")
said("y")

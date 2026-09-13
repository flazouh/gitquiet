/** What the other file borrows, and what it is for. */
export const two = (given: number): number => given * 2

export const unused = "not the one asked for"

export default function main() {
  return two(21)
}

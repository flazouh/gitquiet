import { afterEach } from "bun:test"

/**
 * Cleanup that happens whether the assertions passed or not.
 *
 * The `try/finally` this replaces was never about failure: it was about a test
 * that plants something in the document or patches a prototype, and must put it
 * back even when an expectation in the middle throws. A `finally` says that,
 * and buries the test three levels deep inside it to do so.
 *
 * Called once where the tests are described; the undoing is registered from
 * inside them, and runs in reverse, nearest first.
 */
export const afterwards = (): ((undo: () => void) => void) => {
  const undoing: Array<() => void> = []

  afterEach(() => {
    while (undoing.length > 0) undoing.pop()?.()
  })

  return (undo) => {
    undoing.push(undo)
  }
}

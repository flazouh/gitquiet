import { describe, expect, test } from "bun:test"
import { inThisWindow } from "./somewhere"

/**
 * Storage the window can lean on, including when there is none.
 *
 * Every caller reaches for this while a screen is being drawn, so the failures
 * are worth being sure about: a throw from here is a window that does not open,
 * where the honest outcome is a preference that is not remembered.
 */

/**
 * The global swapped for the length of one test, by descriptor.
 *
 * Bun has a real `localStorage` of its own — assigning over it does nothing —
 * and the interesting cases are the two it cannot be: absent, and refusing.
 */
const withStorage = <A>(store: unknown, work: () => A): A => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage")

  Object.defineProperty(globalThis, "localStorage", {
    value: store,
    configurable: true,
    writable: true
  })

  try {
    return work()
  } finally {
    if (before === undefined) {
      delete (globalThis as { localStorage?: unknown }).localStorage
    } else {
      Object.defineProperty(globalThis, "localStorage", before)
    }
  }
}

const refusing = (): Storage =>
  ({
    getItem: () => {
      throw new Error("the user denied storage")
    },
    setItem: () => {
      throw new Error("QuotaExceededError")
    },
    removeItem: () => {
      throw new Error("the user denied storage")
    }
  }) as unknown as Storage

describe("the window's own storage", () => {
  test("is nothing at all where there is no storage", () => {
    expect(withStorage(undefined, inThisWindow)).toBeNull()
  })

  test("keeps and gives back, where there is one", () => {
    const held = new Map<string, string>()
    const store = {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => held.set(key, value),
      removeItem: (key: string) => held.delete(key)
    }

    withStorage(store, () => {
      const where = inThisWindow()
      where?.setItem("gitquiet.scheme", "dark")
      expect(where?.getItem("gitquiet.scheme")).toBe("dark")
      where?.removeItem("gitquiet.scheme")
      expect(where?.getItem("gitquiet.scheme")).toBeNull()
    })
  })

  test("answers as if nothing were kept when storage refuses", () => {
    // A quota already spent and a session with storage disabled reach here, and
    // from a caller's side both mean the same thing: nothing was remembered. The
    // settings dialog used to turn the second one into a rejected promise.
    withStorage(refusing(), () => {
      const where = inThisWindow()

      expect(where).not.toBeNull()
      expect(where?.getItem("gitquiet.settings")).toBeNull()
      expect(() => where?.setItem("gitquiet.settings", "{}")).not.toThrow()
      expect(() => where?.removeItem("gitquiet.settings")).not.toThrow()
    })
  })
})

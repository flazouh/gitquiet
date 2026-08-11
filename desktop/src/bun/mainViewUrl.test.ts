import { describe, expect, test } from "bun:test"
import { mainViewUrl, waitForVite } from "./mainViewUrl"

describe("mainViewUrl", () => {
  const bundled = "views://main/index.html"
  const vite = "http://127.0.0.1:5173"

  test("uses the Vite URL when the probe succeeds", async () => {
    const found = await mainViewUrl({
      bundled,
      vite,
      probe: async () => true
    })

    expect(found).toEqual({ url: vite, hmr: true })
  })

  test("falls back to the bundled view when the probe fails", async () => {
    const found = await mainViewUrl({
      bundled,
      vite,
      probe: async () => false
    })

    expect(found).toEqual({ url: bundled, hmr: false })
  })

  test("falls back when the probe throws", async () => {
    const found = await mainViewUrl({
      bundled,
      vite,
      probe: async () => {
        throw new Error("connection refused")
      }
    })

    expect(found).toEqual({ url: bundled, hmr: false })
  })
})

describe("waitForVite", () => {
  test("returns true once a later probe succeeds", async () => {
    let attempts = 0
    const up = await waitForVite("http://127.0.0.1:5173", {
      tries: 5,
      pauseMs: 1,
      sleep: async () => {},
      probe: async () => {
        attempts++
        return attempts >= 3
      }
    })

    expect(up).toBe(true)
    expect(attempts).toBe(3)
  })

  test("returns false when every try fails", async () => {
    const up = await waitForVite("http://127.0.0.1:5173", {
      tries: 3,
      pauseMs: 1,
      sleep: async () => {},
      probe: async () => {
        throw new Error("connection refused")
      }
    })

    expect(up).toBe(false)
  })
})

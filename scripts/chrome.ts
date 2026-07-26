/**
 * A minimal DevTools client for checking the built extension on a real page.
 *
 * Chrome 137 and later ignore --load-extension, so unpacked extensions are
 * loaded over the protocol with Extensions.loadUnpacked, which is what
 * --enable-unsafe-extension-debugging turns on.
 */

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const PORT = 9222
const PROFILE = "/tmp/githubpro-csp-profile"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Connection = {
  readonly send: <A,>(method: string, params?: Record<string, unknown>) => Promise<A>
  readonly once: (method: string) => Promise<void>
  readonly close: () => void
}

const connect = async (url: string): Promise<Connection> => {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })

  let sequence = 0
  const send = <A,>(method: string, params: Record<string, unknown> = {}): Promise<A> => {
    const id = ++sequence
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const message = JSON.parse(String(event.data)) as {
          id?: number
          result?: unknown
          error?: { message: string }
        }
        if (message.id !== id) return
        socket.removeEventListener("message", onMessage)
        if (message.error !== undefined) reject(new Error(`${method}: ${message.error.message}`))
        else resolve(message.result as A)
      }
      socket.addEventListener("message", onMessage)
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  const once = (method: string): Promise<void> =>
    new Promise((resolve) => {
      const onMessage = (event: MessageEvent) => {
        const message = JSON.parse(String(event.data)) as { method?: string }
        if (message.method !== method) return
        socket.removeEventListener("message", onMessage)
        resolve()
      }
      socket.addEventListener("message", onMessage)
    })

  return { send, once, close: () => socket.close() }
}

export type Session = {
  readonly extensionId: string
  readonly evaluate: <A,>(expression: string) => Promise<A>
  readonly screenshot: (path: string) => Promise<void>
  readonly stop: () => void
}

/** Launches Chrome with the built extension and opens `url` in a fresh profile. */
export const withExtension = async (url: string, extension: string): Promise<Session> => {
  const chrome = Bun.spawn(
    [
      CHROME,
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--enable-unsafe-extension-debugging",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,900",
      "about:blank"
    ],
    { stdout: "ignore", stderr: "ignore" }
  )

  const version = async (): Promise<{ webSocketDebuggerUrl: string }> => {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()) as {
          webSocketDebuggerUrl: string
        }
      } catch {
        await sleep(250)
      }
    }
    throw new Error("Chrome never opened its debugging port")
  }

  const browser = await connect((await version()).webSocketDebuggerUrl)
  const installed = await browser.send<{ id: string }>("Extensions.loadUnpacked", {
    path: extension
  })

  // Opened blank and navigated from the attached socket: a target created
  // straight onto the URL lands its navigation after we attach and destroys the
  // execution context underneath the first evaluate.
  const created = await browser.send<{ targetId: string }>("Target.createTarget", {
    url: "about:blank"
  })
  const target = (
    (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as ReadonlyArray<{
      id: string
      webSocketDebuggerUrl: string
    }>
  ).find((entry) => entry.id === created.targetId)
  if (target === undefined) throw new Error("The page target vanished")

  const tab = await connect(target.webSocketDebuggerUrl)
  await tab.send("Page.enable")
  const loaded = tab.once("Page.loadEventFired")
  await tab.send("Page.navigate", { url })
  await loaded

  const evaluate = async <A,>(expression: string): Promise<A> => {
    const result = await tab.send<{
      result: { value?: A }
      exceptionDetails?: { text: string; exception?: { description?: string } }
    }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails !== undefined) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result.value as A
  }

  // The content script replaces the whole document, so waiting for our own root
  // is the only reliable signal that it ran.
  await evaluate<boolean>(`
    new Promise((resolve) => {
      const found = () => document.querySelector("#githubpro-root") !== null
      if (found()) return resolve(true)
      const observer = new MutationObserver(() => {
        if (found()) { observer.disconnect(); resolve(true) }
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
      setTimeout(() => { observer.disconnect(); resolve(found()) }, 20000)
    })
  `)
  await sleep(2000)

  return {
    extensionId: installed.id,
    evaluate,
    screenshot: async (path: string) => {
      const shot = await tab.send<{ data: string }>("Page.captureScreenshot", { format: "png" })
      await Bun.write(path, Buffer.from(shot.data, "base64"))
    },
    stop: () => {
      tab.close()
      browser.close()
      chrome.kill()
    }
  }
}

/**
 * A minimal DevTools client for checking the built extension on a real page.
 *
 * Chrome 137 and later ignore --load-extension, so unpacked extensions are
 * loaded over the protocol with Extensions.loadUnpacked, which is what
 * --enable-unsafe-extension-debugging turns on.
 */

/**
 * A Chrome that can load an unpacked extension, wherever this machine keeps one.
 *
 * Hardcoding the usual path meant the harness stopped working the day Chrome
 * was not in Applications, with an ENOENT that says nothing about extensions.
 * Chrome for Testing, which lands in the Puppeteer cache, does the job equally
 * well and is what continuous integration would have anyway.
 */
export const findChrome = (): string => {
  const candidates = [
    process.env["CHROME_PATH"],
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ...new Bun.Glob("chrome/*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/*")
      .scanSync({ cwd: `${process.env["HOME"]}/.cache/puppeteer`, absolute: true, onlyFiles: true })
  ].filter((path): path is string => path !== undefined)

  for (const candidate of candidates) {
    if (Bun.file(candidate).size > 0) return candidate
  }
  throw new Error(
    `No Chrome found. Install one, or set CHROME_PATH. Looked in:\n  ${candidates.join("\n  ")}`
  )
}

const CHROME = findChrome()
const PORT = 9222
const PROFILE = "/tmp/gitquiet-csp-profile"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type Connection = {
  readonly send: <A,>(method: string, params?: Record<string, unknown>) => Promise<A>
  readonly once: (method: string) => Promise<void>
  readonly on: (method: string, handle: (params: Record<string, unknown>) => void) => void
  readonly close: () => void
}

export const connect = async (url: string): Promise<Connection> => {
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

  const on = (method: string, handle: (params: Record<string, unknown>) => void): void => {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        method?: string
        params?: Record<string, unknown>
      }
      if (message.method === method) handle(message.params ?? {})
    })
  }

  return { send, once, on, close: () => socket.close() }
}

export type Session = {
  readonly extensionId: string
  readonly evaluate: <A,>(expression: string) => Promise<A>
  /**
   * Evaluates in the content script's own world rather than the page's. The two
   * differ in ways that matter here — fetch credentials, extension APIs — so a
   * thing that works in one can hang in the other.
   */
  readonly evaluateInExtension: <A,>(expression: string) => Promise<A>
  readonly screenshot: (path: string) => Promise<void>
  /** Everything the page logged as an error, which is how a failure screen explains itself. */
  readonly problems: () => ReadonlyArray<string>
  readonly stop: () => void
}

export type Options = {
  /**
   * Cookies to install before the first navigation, in the shape
   * Network.getCookies returns. The profile is a fresh one, so without these the
   * visit is signed out and the interface only ever reaches its failure screen.
   */
  readonly cookies?: ReadonlyArray<Record<string, unknown>>
}

/** Launches Chrome with the built extension and opens `url` in a fresh profile. */
export const withExtension = async (
  url: string,
  extension: string,
  options: Options = {}
): Promise<Session> => {
  const chrome = Bun.spawn(
    [
      CHROME,
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      // Loaded by flag rather than by Extensions.loadUnpacked: that CDP domain
      // arrived after Chrome 128, and the Chrome for Testing sitting in a cache
      // is usually older than that. The flag has worked since extensions did.
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
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
  /*
   * Asked for, and not depended on.
   *
   * The flag above has already loaded it. Where this domain exists the second ask
   * is harmless, and where it does not — a Chrome for Testing older than 128, which
   * is what a cache usually holds — the answer is an error about the method rather
   * than about the extension. Refusing to go on at that point stopped every live
   * check in the repository on a Chrome that had loaded the extension perfectly
   * well. `.catch` rather than `try`, which the lint rule reserves for `Effect`.
   */
  const installed = await browser
    .send<{ id: string }>("Extensions.loadUnpacked", { path: extension })
    .catch(() => undefined)

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

  if (options.cookies !== undefined && options.cookies.length > 0) {
    await browser.send("Storage.setCookies", { cookies: options.cookies })
  }

  const tab = await connect(target.webSocketDebuggerUrl)

  // The content script reports its own failures through the console, so they are
  // collected here rather than left for someone to find in a devtools window.
  const problems: Array<string> = []
  tab.on("Runtime.exceptionThrown", (params) => {
    const details = params["exceptionDetails"] as
      | { text?: string; exception?: { description?: string } }
      | undefined
    problems.push(details?.exception?.description ?? details?.text ?? "unknown exception")
  })
  tab.on("Runtime.consoleAPICalled", (params) => {
    if (params["type"] !== "error") return
    const args = (params["args"] ?? []) as ReadonlyArray<{ value?: unknown; description?: string }>
    problems.push(
      args.map((arg) => arg.description ?? JSON.stringify(arg.value ?? null)).join(" ")
    )
  })
  const worlds = new Map<string, number>()
  /** Read off the content script's own origin, which is where it is true. */
  let seenId = ""
  tab.on("Runtime.executionContextCreated", (params) => {
    const context = params["context"] as {
      id: number
      origin?: string
      auxData?: { type?: string }
    }
    if ((context.origin ?? "").startsWith("chrome-extension://")) {
      worlds.set("extension", context.id)
      seenId = (context.origin ?? "").slice("chrome-extension://".length)
    }
  })
  await tab.send("Runtime.enable")

  await tab.send("Page.enable")
  const loaded = tab.once("Page.loadEventFired")
  await tab.send("Page.navigate", { url })
  await loaded

  const evaluateIn = async <A,>(
    expression: string,
    contextId?: number
  ): Promise<A> => {
    const result = await tab.send<{
      result: { value?: A }
      exceptionDetails?: { text: string; exception?: { description?: string } }
    }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      ...(contextId === undefined ? {} : { contextId })
    })
    if (result.exceptionDetails !== undefined) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result.value as A
  }

  const evaluate = <A,>(expression: string): Promise<A> => evaluateIn<A>(expression)

  // The content script replaces the whole document, so waiting for our own root
  // is the only reliable signal that it ran.
  await evaluate<boolean>(`
    new Promise((resolve) => {
      const found = () => document.querySelector("#gitquiet-root") !== null
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
    extensionId: installed?.id ?? seenId,
    evaluate,
    evaluateInExtension: <A,>(expression: string): Promise<A> => {
      const world = worlds.get("extension")
      if (world === undefined) throw new Error("The content script's world never appeared")
      return evaluateIn<A>(expression, world)
    },
    screenshot: async (path: string) => {
      const shot = await tab.send<{ data: string }>("Page.captureScreenshot", { format: "png" })
      await Bun.write(path, Buffer.from(shot.data, "base64"))
    },
    problems: () => problems,
    stop: () => {
      tab.close()
      browser.close()
      chrome.kill()
    }
  }
}

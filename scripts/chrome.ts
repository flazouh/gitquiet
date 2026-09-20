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
/**
 * The Puppeteer cache's contribution to the candidates, on a machine that has one.
 *
 * `scanSync` throws ENOENT on the directory rather than answering nothing, and it
 * threw while the candidate list was still being built — so a machine without the
 * cache never got as far as the CHROME_PATH it had set.
 */
const inPuppeteerCache = (): ReadonlyArray<string> => {
  try {
    return [
      ...new Bun.Glob("chrome/*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/*")
        .scanSync({ cwd: `${process.env["HOME"]}/.cache/puppeteer`, absolute: true, onlyFiles: true })
    ]
  } catch {
    return []
  }
}

export const findChrome = (): string => {
  const candidates = [
    process.env["CHROME_PATH"],
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    // Linux, where a Chrome installed from Google's own package lands. The list
    // held two Mac paths and a Puppeteer cache, so every live probe in this
    // repository failed on a Linux machine with Chrome installed — with an
    // error naming two folders that machine was never going to have.
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    ...inPuppeteerCache()
  ].filter((path): path is string => path !== undefined)

  for (const candidate of candidates) {
    if (Bun.file(candidate).size > 0) return candidate
  }
  throw new Error(
    `No Chrome found. Install one, or set CHROME_PATH. Looked in:\n  ${candidates.join("\n  ")}`
  )
}

const CHROME = findChrome()

/**
 * The port this harness talks to Chrome on, and the reason it can be moved.
 *
 * A probe spawns its own Chrome and then polls the port until something answers.
 * Something else answering is not a case it could tell apart: a Chrome the reader
 * already had open with remote debugging on takes the port, replies to the poll,
 * and every step after it — the extension, the target, the evaluates — is run
 * against their own browser and their own tabs. Which happened, on 9222, to a
 * Chrome with seven tabs of somebody's evening in it.
 *
 * A probe that must not touch a browser already running sets this to a port
 * nothing else has. The default stays where every existing probe expects it.
 */
const PORT = Number(process.env["GITQUIET_CDP_PORT"] ?? 9222)
const PROFILE = process.env["GITQUIET_CDP_PROFILE"] ?? "/tmp/gitquiet-csp-profile"

/**
 * Whether to run without a window, which on a machine with no display is the
 * only way to run at all.
 *
 * Chrome asked for a window where there is none does not fail: it starts, never
 * opens its debugging port, and every probe here waits fifteen seconds and then
 * reports that Chrome never opened it — which reads as a broken harness rather
 * than as a missing display. So the display is checked rather than assumed.
 *
 * `--headless=new` and not the old one. The old headless was a different
 * renderer that painted nothing and ran no animations, and a probe that measures
 * an arrival would have measured a page of zeroes; the new one is the same
 * renderer as a window, without the window.
 *
 * `GITQUIET_CDP_HEADLESS` overrides in both directions, for a machine that has a
 * display and wants to watch, and for one that has a display and would rather not.
 */
const asked = process.env["GITQUIET_CDP_HEADLESS"]
const HEADLESS =
  asked === undefined
    ? process.platform === "linux" &&
      (process.env["DISPLAY"] ?? "") === "" &&
      (process.env["WAYLAND_DISPLAY"] ?? "") === ""
    : asked !== "0" && asked !== "false"

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
  /**
   * The DevTools connection to the page itself, for a probe that needs a domain
   * this file has no opinion about — network conditions, input, tracing. The
   * page is already attached and `Runtime` and `Page` are already enabled on it.
   */
  readonly tab: Connection
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
  /**
   * A script to run in the page before anything else in the document does,
   * including the content script.
   *
   * The arrival is the thing most worth measuring here and it is over before an
   * `evaluate` can be sent: by the time the navigation has settled enough to
   * talk to, the interface has already been put on the page. A recorder has to
   * be installed ahead of the document rather than asked afterwards, which is
   * what `Page.addScriptToEvaluateOnNewDocument` is for.
   */
  readonly before?: string
  /**
   * Whether to wait for the page's load event before handing the session back.
   *
   * On by default, because a probe usually wants a drawn page. Off for the one
   * question that cannot be asked that way: how responsive a page is *while* it
   * is arriving. `spf13/cobra`'s `command.go` takes twenty-six seconds to fire
   * `load` with no extension at all, so a probe that waits for it spends its
   * whole budget waiting and prints nothing — which reads exactly like a clean
   * run. Measured, and the reason this switch exists.
   */
  readonly awaitLoad?: boolean
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
      //
      // Without `--disable-extensions-except` beside it, which used to be here
      // and was the quiet end of every probe on a current Chrome. Chrome 137 and
      // later ignore `--load-extension`, so the extension arrives over the
      // protocol instead — and on Chrome 153, measured, an extension loaded that
      // way is still *excepted* by that flag: it installs, it reports an id, and
      // none of its content scripts ever run. The isolated world never appears
      // and the probe reports that the content script's world never appeared,
      // which reads as a broken extension rather than as a flag.
      `--load-extension=${extension}`,
      "--enable-unsafe-extension-debugging",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,900",
      ...(HEADLESS ? ["--headless=new", "--disable-gpu"] : []),
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
  if (options.before !== undefined) {
    await tab.send("Page.addScriptToEvaluateOnNewDocument", { source: options.before })
  }
  const loaded = tab.once("Page.loadEventFired")
  await tab.send("Page.navigate", { url })
  if (options.awaitLoad !== false) await loaded

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
  /*
   * Waited for from here, not from inside the page.
   *
   * The cap below is a page-side `setTimeout`, and a page whose main thread is
   * held does not run timers — so on a heavy file this never came back at all
   * and the probe hung rather than measuring the very thing it was sent to
   * measure. Raced against a timer on this side, which keeps running whatever
   * the page is doing.
   */
  const withinNode = <A,>(work: Promise<A>, ms: number, fallback: A): Promise<A> =>
    Promise.race([work, sleep(ms).then(() => fallback)])

  await withinNode(evaluate<boolean>(`
    new Promise((resolve) => {
      const found = () => document.querySelector("#gitquiet-root") !== null
      if (found()) return resolve(true)
      const until = Date.now() + 20000
      /*
       * The document may not exist yet.
       *
       * Asked before the load event — which is how a probe measures a page
       * while it is arriving — there can be no \`documentElement\` to observe,
       * and \`observe\` throws on null. That threw inside an evaluate, so the
       * probe died before printing anything and three runs read as a page that
       * behaved.
       */
      const watch = () => {
        const root = document.documentElement
        if (root === null) {
          if (Date.now() > until) return resolve(false)
          setTimeout(watch, 50)
          return
        }
        const observer = new MutationObserver(() => {
          if (found()) { observer.disconnect(); resolve(true) }
        })
        observer.observe(root, { childList: true, subtree: true })
        setTimeout(() => { observer.disconnect(); resolve(found()) }, Math.max(0, until - Date.now()))
      }
      watch()
    })
  `), 25_000, false)
  await sleep(2000)

  return {
    extensionId: installed?.id ?? seenId,
    tab,
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

/**
 * The renderer's panes, wherever the interface happens to be standing.
 *
 * A snippet to inline in an `evaluate`, rather than a function here, because it
 * has to run in the page and every probe already inlines its helpers this way.
 *
 * It exists because `document.querySelector("diffs-container")` stopped
 * reaching one. The interface stands in a shadow root on a host of its own, and
 * a query on the document crosses no shadow boundary — so every probe that
 * looked for a pane that way found none and reported that the name was never
 * drawn, on pages that were drawing it perfectly well. A harness that answers
 * "broken" when it means "I cannot see" costs more than no harness, and it cost
 * this one an afternoon.
 *
 * Not walked into the pane's own root: it holds a span per token, and sweeping
 * it on a poll is slow enough to be the thing a probe times out on. There is no
 * pane inside a pane.
 *
 *     const seen = await session.evaluate(`
 *       (() => { ${PANES} return panes().length })()
 *     `)
 */
export const PANES = `
  const panes = () => {
    const found = []
    const walk = (node) => {
      for (const el of node.querySelectorAll("*")) {
        if (!el.shadowRoot) continue
        if (el.tagName.toLowerCase() === "diffs-container") found.push(el.shadowRoot)
        else walk(el.shadowRoot)
      }
    }
    walk(document)
    return found
  }
`

/**
 * A way to read the window from outside it.
 *
 * A webview in an Electrobun app is not a browser tab: there is no CDP endpoint
 * to attach to, and the window does not appear to `screencapture` or to
 * AppleScript, so anybody working on this app from a terminal — a person on a
 * second machine, an agent, a CI job — has no way to find out what is on the
 * screen. That is a bad way to build an interface, and it is the reason for this
 * file.
 *
 * The webview already knows how to evaluate a script and answer with the result:
 * Electrobun registers `evaluateJavascriptWithResponse` on the view's own RPC.
 * All this adds is a door onto it.
 *
 * One thing to know before spending an afternoon on it, as this file's author did:
 * **the window has to be on screen.** WebKit suspends a web content process whose
 * window is fully covered — by a full-screen editor, for instance — and a
 * suspended page runs no script at all: no timers, no answers to anything asked
 * here, and no error either, because nothing is running to raise one. It comes
 * back when the window does. So a door that has gone quiet is usually a window
 * somebody covered up, and `/said` below is the log that survives it.
 *
 * Three guards, because the door reads and writes a signed-in app:
 * it binds to 127.0.0.1 and nothing else, it opens only when
 * `GITQUIET_INSPECT` names a port, and the variable is set by `bun run dev`
 * rather than by the app — so a build somebody downloads has no door at all,
 * whatever they set in their shell.
 */

/** Runs a script in the webview and answers with what it returned. */
export type Evaluate = (script: string) => Promise<unknown>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  })

/**
 * What the interface currently is, as text and as markup.
 *
 * `innerText` first because it is what most questions are actually about — is
 * the list drawn, does it say signed in, did the error appear — and because a
 * page of Tailwind markup is thousands of tokens to answer "what does it say".
 */
const READS: Record<string, string> = {
  "/text": "return document.getElementById('gitquiet-root')?.innerText ?? '(no root)'",
  "/dom": "return document.getElementById('gitquiet-root')?.outerHTML ?? '(no root)'",
  "/title": "return document.title",
  // What the interface has said, which no terminal sees on its own.
  "/log": "return globalThis.__recorded ? globalThis.__recorded() : '(nothing is recording)'",
  // Everything the interface is currently animating, which is the one thing
  // reading markup cannot tell you.
  "/motion":
    "return Array.from(document.querySelectorAll('[class*=\"t-\"]')).map(el => el.className)"
}

/** What the door can ask of the window itself, rather than of the page in it. */
export type Handles = {
  readonly openDevTools: () => void
  /**
   * Brings the window to the front.
   *
   * Not a convenience. This window is invisible to `screencapture` while anything
   * covers it and invisible to AppleScript always — `System Events` does not list
   * the process, so `activate` addressed to it does nothing — which means that
   * with the editor in front of it there is no way from a terminal to see the
   * interface at all. Electrobun's own `activate` can do it from inside, so the
   * door offers it.
   */
  readonly raise: () => void
}

export const openInspector = (evaluate: Evaluate, port: number, handles: Handles) => {
  /*
   * A door that will not open is not a reason to pull the building down. An
   * earlier copy of this app still holding the port used to be an uncaught
   * throw during startup, which killed the window — so the one run that could
   * not be inspected was also the one run that did not exist, and the reported
   * fault was "the app crashed" rather than "something is already listening".
   */
  let server: ReturnType<typeof Bun.serve>
  try {
    server = serveOn(evaluate, port, handles)
  } catch (cause) {
    console.error(
      `[working-set] no inspector on ${port}: ${cause instanceof Error ? cause.message : String(cause)}`
    )
    return null
  }

  console.log(`[working-set] inspect: curl -s 127.0.0.1:${server.port}/text`)

  return server
}

/**
 * What the interface has said, kept on this side of the bridge.
 *
 * The webview posts here, which is the point: everything else in this file asks
 * the webview a question and waits for it to answer, so the one situation worth
 * having a log for — a webview that has stopped answering — is the one situation
 * none of it works in. A `fetch` out of the page needs nothing from the bridge.
 */
const said: Array<string> = []
const KEEP = 500

/**
 * Waiting forever is not an answer.
 *
 * The main process gives its own requests fifteen minutes, which is right for a
 * sign-in somebody is typing and wrong for this: a question about the screen is
 * either answered now or the page is not running, and hanging a terminal for
 * fifteen minutes to say so wastes the one thing the door was built to save.
 */
const PATIENCE = 5000

const WHY = `the webview did not answer in ${PATIENCE}ms — if its window is covered, WebKit has suspended the page and it will answer again when the window is back on screen`

const answered = async (evaluate: Evaluate, script: string): Promise<unknown> => {
  let ticking: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      evaluate(script),
      new Promise((_, refuse) => {
        ticking = setTimeout(() => refuse(new Error(WHY)), PATIENCE)
      })
    ])
  } finally {
    if (ticking !== undefined) clearTimeout(ticking)
  }
}

const serveOn = (evaluate: Evaluate, port: number, handles: Handles) =>
  Bun.serve({
    hostname: "127.0.0.1",
    port,
    idleTimeout: 30,
    fetch: async (request) => {
      const path = new URL(request.url).pathname

      if (path === "/") {
        return json({
          reads: [...Object.keys(READS), "/said"],
          post: { "/eval": "a JavaScript body that returns something JSON can hold" },
          also: [
            "/devtools opens Safari's inspector on the window",
            "/raise brings the window to the front, which nothing outside it can",
            "/said is what the interface has said, which needs nothing of the webview"
          ]
        })
      }

      if (path === "/said") {
        if (request.method !== "POST") return json({ ok: true, it: said })

        const line = await request.text()
        said.push(line)
        if (said.length > KEEP) said.shift()
        // Echoed rather than only kept: a terminal running `bun run dev` is where
        // somebody is already looking when the interface goes wrong.
        console.log(`[view] ${line}`)
        return json({ ok: true })
      }

      if (path === "/devtools") {
        handles.openDevTools()
        return json({ ok: true, it: "opened" })
      }

      if (path === "/raise") {
        handles.raise()
        return json({ ok: true, it: "in front" })
      }

      const script = path === "/eval" ? await request.text() : READS[path]
      if (script === undefined) return json({ ok: false, why: `nothing at ${path}` }, 404)

      try {
        return json({ ok: true, it: await answered(evaluate, script) })
      } catch (cause) {
        // A script that threw, a value the socket could not carry, or a webview
        // that has gone. All three are the answer to the question that was
        // asked, so all three come back as an answer rather than a dead socket.
        return json({ ok: false, why: cause instanceof Error ? cause.message : String(cause) }, 200)
      }
    }
  })

import { Effect, Option } from "effect"
import type {
  Check,
  Commit,
  Participant,
  PullRequestSnapshot,
  Remark,
  Review,
  ReviewThread,
  ThreadAnchor,
  ThreadComment
} from "../../src/domain/PullRequest"
import { hold } from "../../src/ui/held"
import { PullRequestScreen } from "../../src/ui/PullRequestScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf, MOCK_VIEWER } from "./faces"
import { fileFrom } from "./patch"
import { hoursAgo, minutesAgo } from "./when"

/**
 * One pull request, as the screen that replaces GitHub's conversation tab.
 *
 * The argument this picture has to make is the panel at the top left: the same pull
 * request GitHub files by object type, filed instead by who owes the next move. So
 * the data is chosen to fill three of the four Courts. A pull request with one green
 * check and nothing else on it is a truthful screenshot of an interface with nothing
 * to say.
 *
 * A real repository, and one whose code is recognisable at a glance. `oven-sh/bun` is
 * Zig, which nothing else on the store page looks like, and the failure being reviewed
 * here is the ordinary kind: a socket closed under a stream that had not finished.
 * Nothing here is anybody's private repository.
 *
 * The reader is a Reviewer rather than the Author, which is what makes the picture
 * whole. Only a Reviewer has a Last Review Point, so only a Reviewer's panel can say
 * what landed since they were last here, and only a Reviewer is offered the verdict
 * box under the conversation.
 */

const VIEWER = MOCK_VIEWER

const REFERENCE = { owner: "oven-sh", repo: "bun", number: 23014 } as const

/** What the unsent remark is kept under. `About` spells the same name for the panel. */
const SUBJECT = `pull:${REFERENCE.owner}/${REFERENCE.repo}#${REFERENCE.number}`

const person = (login: string): Participant => ({
  login,
  isAutomated: false,
  faceUrl: faceOf(login)
})

const machine = (login: string): Participant => ({
  login,
  isAutomated: true,
  faceUrl: faceOf(login)
})

/*
 * The patches, at the left margin and one per file.
 *
 * Written as text rather than as `DiffLine` objects because the renderer reads a
 * patch: see `patch.ts`, which counts the line numbers off the hunk headers so that
 * the threads below can be hung from lines this diff really has.
 */

const SERVER = `
@@ -2417,8 +2417,20 @@ pub fn onResolve(this: *RequestContext, result: JSValue) void {
     if (this.flags.aborted) {
         this.finalizeForAbort();
         return;
     }
-    if (this.response_ptr) |response| {
-        this.renderResponse(response);
-    }
+    // A stream aborted between chunks still owns the sink, and rendering over
+    // the top of it wrote a second set of headers onto a socket uWS had already
+    // taken back.
+    if (this.response_ptr) |response| {
+        if (this.flags.has_written_status and this.byte_stream != null) {
+            this.detachByteStream();
+        }
+        this.renderResponse(response);
+    }
+
+    if (this.flags.aborted_mid_chunk) {
+        this.endStream(this.shouldCloseConnection());
+        this.finalizeForAbort();
+        return;
+    }
 }
@@ -2601,5 +2613,6 @@ pub fn detachByteStream(this: *RequestContext) void {
     if (this.byte_stream) |stream| {
         stream.unpipeWithoutDeref();
-        this.byte_stream = null;
+        this.byte_stream = null;
+        this.flags.aborted_mid_chunk = !stream.has_received_last_chunk;
     }
 }
@@ -2744,7 +2757,9 @@ fn onWritableBytes(this: *RequestContext, write_offset: u64) bool {
     const bytes = this.blob.slice();
     if (write_offset >= bytes.len) {
-        this.endStream(false);
+        // Ending here closed the connection on every keep-alive request whose
+        // body happened to land on the sink boundary.
+        this.endStream(this.shouldCloseConnection());
         return true;
     }
     return this.sendWritableBytesForCompleteResponseBuffer(bytes, write_offset);
 }
`

const RESPONSE = `
@@ -1180,6 +1180,11 @@ pub fn getBody(this: *Response, globalThis: *JSGlobalObject) JSValue {
     return this.body.value.toReadableStream(globalThis);
 }
 
+/// Whether the last chunk of the body reached the sink before it was detached.
+/// Read by \`RequestContext.detachByteStream\`, which cannot ask the stream once
+/// it has been unpiped.
+pub var has_received_last_chunk: bool = false;
+
 pub fn getBodyUsed(this: *Response, _: *JSGlobalObject) JSValue {
     return JSValue.jsBoolean(this.body.value.isDisturbed());
 }
`

const STREAMS = `
@@ -3412,8 +3412,12 @@ pub fn onPull(this: *ByteStream, buffer: []u8) StreamResult {
     if (this.has_received_last_chunk) {
         return .{ .done = {} };
     }
-    if (this.pending.state == .pending) {
-        return .{ .pending = &this.pending };
-    }
+
+    // The pending result is handed out once. Returning it again while the sink
+    // was draining gave two owners to one promise, which is the abort this fixes.
+    if (this.pending.state == .pending) {
+        if (this.pending.result == .into_array) return .{ .pending = &this.pending };
+        return .{ .temporary = bun.ByteList.init(buffer[0..0]) };
+    }
     return .{ .temporary = bun.ByteList.init(buffer[0..0]) };
 }
`

const WEBSOCKET = `
@@ -612,4 +612,7 @@ pub fn handleData(this: *HTTPClient, socket: Socket, data: []const u8) void {
     if (this.to_send.len == 0) {
+        // Nothing left to send is not the same as nothing left to read, and
+        // treating them alike closed the socket under an upgrade in flight.
+        if (this.is_reading) return;
         this.terminate(ErrorCode.ended);
         return;
     }
`

const HTTP = `
@@ -948,5 +948,5 @@ pub fn onClose(client: *HTTPClient) void {
     if (client.state.response_stage == .body) {
-        client.state.fail = error.ConnectionClosed;
+        client.state.fail = if (client.state.received_last_chunk) null else error.ConnectionClosed;
     }
     client.deinit();
 }
`

const ABORT_TEST = `
@@ -1,5 +1,5 @@
 import { describe, expect, test } from "bun:test";
-import { serve } from "bun";
+import { serve, sleep } from "bun";
 import { bunEnv, bunExe } from "harness";
 
 describe("Bun.serve() aborting", () => {
@@ -88,4 +88,26 @@ describe("Bun.serve() aborting", () => {
     expect(await response.text()).toBe("hello");
     server.stop(true);
   });
+
+  test("keeps a keep-alive socket when a stream aborts mid-chunk", async () => {
+    using server = serve({
+      port: 0,
+      async fetch() {
+        return new Response(
+          new ReadableStream({
+            async pull(controller) {
+              controller.enqueue("first");
+              await sleep(20);
+              controller.error(new Error("upstream went away"));
+            },
+          }),
+        );
+      },
+    });
+
+    const response = await fetch(server.url);
+    expect(response.status).toBe(200);
+    await expect(response.text()).rejects.toThrow();
+    expect(server.pendingRequests).toBe(0);
+  });
 });
`

const STREAM_TEST = `
@@ -142,7 +142,8 @@ describe("Bun.serve() streaming", () => {
     const chunks: string[] = [];
     for await (const chunk of response.body!) {
-      chunks.push(new TextDecoder().decode(chunk));
+      chunks.push(decoder.decode(chunk, { stream: true }));
     }
-    expect(chunks).toEqual(["a", "b"]);
+    chunks.push(decoder.decode());
+    expect(chunks.filter(Boolean)).toEqual(["a", "b"]);
     server.stop(true);
   });
`

/*
 * The rail's order is not this order: folders go above loose files and everything
 * is sorted by name, so `src/bun.js/api/server.zig` is the file the panel opens on.
 * That is deliberate. It carries three hunks and the two threads, so the picture is
 * of a diff being reviewed rather than of a diff being scrolled.
 *
 * Two files are marked as already read, so the rail's ticks and the "seen" bar have
 * something to say. A pull request where nothing has been opened is the state before
 * the reading starts.
 */
const FILES = [
  fileFrom("src/bun.js/api/server.zig", SERVER),
  fileFrom("src/bun.js/webcore/response.zig", RESPONSE, { readByViewer: true }),
  fileFrom("src/bun.js/webcore/streams.zig", STREAMS),
  fileFrom("src/http/websocket_http_client.zig", WEBSOCKET),
  fileFrom("src/http.zig", HTTP, { readByViewer: true }),
  fileFrom("test/js/bun/http/serve-abort.test.ts", ABORT_TEST),
  fileFrom("test/js/bun/http/serve-stream.test.ts", STREAM_TEST)
]



/**
 * The three files this pull request did not touch, as they would read.
 *
 * The stage has no route to GitHub and `wholeOf` above only knows the files
 * that have a patch, so a file brought in would otherwise draw as sixty lines
 * of filler. These are what the pane exists to show: ordinary code, in a file
 * the change never mentions, with the line somebody wants to point at in it.
 */
const UNTOUCHED: Readonly<Record<string, ReadonlyArray<string>>> = {
  "src/bun.js/api/config.zig": [
    "const std = @import(\"std\");",
    "const bun = @import(\"root\").bun;",
    "",
    "/// Flags a response carries while it is being written.",
    "///",
    "/// The order matters: `has_written_status` is checked before the body is",
    "/// touched, and `detachByteStream` clears both together.",
    "pub const ResponseFlags = packed struct(u8) {",
    "    aborted: bool = false,",
    "    has_written_status: bool = false,",
    "    is_waiting_body: bool = false,",
    "    _padding: u5 = 0,",
    "",
    "    pub fn clear(this: *ResponseFlags) void {",
    "        this.has_written_status = false;",
    "        this.is_waiting_body = false;",
    "    }",
    "};",
    "",
    "pub const Defaults = struct {",
    "    pub const max_header_bytes: usize = 16 * 1024;",
    "    pub const idle_timeout_ms: u32 = 10_000;",
    "};"
  ],
  "src/bun.js/webcore/blob.zig": [
    "const std = @import(\"std\");",
    "",
    "pub const Blob = struct {",
    "    bytes: []u8,",
    "    offset: usize = 0,",
    "};"
  ],
  "src/http/websocket.zig": [
    "const std = @import(\"std\");",
    "",
    "pub const Opcode = enum(u4) { text = 0x1, binary = 0x2, close = 0x8 };"
  ]
}

const BASE_SHA = "9c1b5f4e2a7d3086bb41f5c9e0d27a6318f4b0c5"

/**
 * One whole half of a file, built so that diffing the two halves gives back
 * that file's own patch and nothing else.
 *
 * The stage has no route to GitHub, and revealing the lines between the hunks
 * needs the rest of the file. Inventing text will not do: the renderer diffs
 * the halves it is handed against the patch it already parsed, and unrelated
 * text made it throw `deletionLine and additionLine are null`. The shots caught
 * that and no unit test could, because they stub the renderer.
 *
 * So the halves are built out of the patch. Every line the patch names goes at
 * the number the patch gives it, and the gaps are filled by a counter rather
 * than by the line number — the tenth untouched line of one half is the tenth
 * of the other, whatever the hunks have done to the numbering between them, so
 * the two align exactly and the only difference left is the change itself.
 */
const wholeOf = (path: string, half: "before" | "after", beyond = 60): string => {
  const file = FILES.find((one) => one.path === path)
  const lines = file === undefined ? [] : Option.getOrElse(Option.map(file.diff, (held) => held.lines), () => [])

  const named = new Map<number, string>()
  for (const line of lines) {
    if (line.kind === "hunk") continue
    const at = half === "before" ? line.beforeLine : line.afterLine
    if (Option.isSome(at)) named.set(at.value, line.text.slice(1))
  }

  // A little past the last hunk, so there is something to reveal at the end
  // without the stage building thousands of lines it never draws.
  const highest = Math.max(0, ...named.keys()) + beyond
  let untouched = 0
  const out: Array<string> = []
  for (let at = 1; at <= highest; at += 1) {
    const said = named.get(at)
    if (said !== undefined) {
      out.push(said)
      continue
    }
    untouched += 1
    out.push(`// untouched line ${untouched}`)
  }
  return out.join("\n")
}

const commit = (sha: string, headline: string, hours: number): Commit => ({
  sha,
  abbreviatedSha: sha.slice(0, 7),
  author: "jhalvorsen",
  headline,
  createdAt: hoursAgo(hours)
})

/**
 * Oldest first, which is the order GitHub sends them and the order they landed.
 *
 * Full forty-character hashes, and hexadecimal, because the row abbreviates whatever it
 * is given to seven and the merge card quotes one in a sentence. A stand-in built by
 * repeating a digit read as a stand-in at both lengths, which on a photograph of a real
 * repository is the one detail that gives the rest away.
 */
const COMMITS: ReadonlyArray<Commit> = [
  commit(
    "5b2c1a97e0d43f86ba250cf7e13a9d4682bc07fe",
    "Keep a keep-alive socket open when a stream aborts mid-chunk",
    31
  ),
  commit(
    "a71e6403cb8d295f0e14b7da6035c8f291d4be7a",
    "Detach the byte stream before rendering over it",
    28
  ),
  commit(
    "c39da05e174b2f68901ecd7a5b40f2e86371ac9d",
    "Hand the pending stream result to one owner",
    26
  ),
  commit(
    "0e4f81b6d3a72c95401bf8e2d76c05a394be1d28",
    "Add a regression test for an aborted stream",
    6
  ),
  commit(
    "d8206ce4b917af35026d1fb8e4c70a591328db6f",
    "Do not treat an empty send queue as an ended socket",
    4
  ),
  commit(
    "f4a97b12e6c05d38b7124ae0d95f36c8071be2d4",
    "Decode streamed chunks with one decoder",
    2
  )
]

/** The head of the branch, which is the last commit on it. */
const HEAD_SHA = COMMITS[COMMITS.length - 1]?.sha ?? ""

/**
 * Where this reader's last review left off, which is the third of six.
 *
 * The three after it are what the owed panel counts as Since Last Review, and they
 * are the ones that landed in the last six hours. That gap is the whole case for the
 * row: a reviewer coming back to a pull request cannot see it anywhere on GitHub.
 */
const LAST_REVIEW_POINT = COMMITS[2]?.sha ?? ""

const said = (
  id: string,
  author: Participant,
  body: string,
  minutes: number
): ThreadComment => ({
  id,
  author,
  body,
  html: `<p>${body}</p>`,
  createdAt: minutesAgo(minutes)
})

const at = (path: string, line: number): Option.Option<ThreadAnchor> =>
  Option.some({ path, lines: { side: "after", line, startLine: line } })

/**
 * The conversation, chosen so that the owed panel has more than one Court in it.
 *
 * Two Bot Findings, because that is what a pull request in this repository looks
 * like now and because the panel's word for them is the vocabulary's: a finding is
 * answered differently from a colleague, and six of each is not the same afternoon.
 * One of the two is already answered by the reader and stays theirs, which is the
 * count `attention.ts` was written from.
 *
 * The thread the reader spoke in last is Waiting, and the resolved one is Settled, so
 * three of the four Courts are drawn and the fourth holds the running checks.
 */
const THREADS: ReadonlyArray<ReviewThread> = [
  {
    id: "T-1",
    isResolved: false,
    at: at("src/bun.js/api/server.zig", 2425),
    comments: [
      said(
        "C-1",
        machine("review-bot[bot]"),
        "`has_written_status` is read before `detachByteStream` clears it, so a response that was already partly written takes this branch twice. Consider capturing it above the `if`.",
        88
      )
    ]
  },
  {
    id: "T-2",
    isResolved: false,
    at: at("src/bun.js/webcore/streams.zig", 3418),
    comments: [
      said(
        "C-2",
        machine("agent-bot[bot]"),
        "The early return leaves `pending.state` at `.pending` while the sink is draining, so a second `onPull` on the same tick still finds a promise nobody owns.",
        76
      ),
      said(
        "C-3",
        person(VIEWER),
        "That is the case the new test covers. The state is cleared by `detachByteStream` now, one caller up.",
        41
      )
    ]
  },
  {
    id: "T-3",
    isResolved: false,
    at: at("src/bun.js/api/server.zig", 2431),
    comments: [
      said(
        "C-4",
        person("dperrault"),
        "Does this need to run before `renderResponse`? On a HEAD request there is no body to end and this ends the stream anyway.",
        34
      )
    ]
  },
  {
    id: "T-4",
    isResolved: false,
    at: at("test/js/bun/http/serve-abort.test.ts", 100),
    comments: [
      said(
        "C-5",
        person("linnea-h"),
        "Twenty milliseconds is going to be flaky on the Windows runners.",
        29
      ),
      said(
        "C-6",
        person(VIEWER),
        "Replaced with a promise the test resolves itself, so nothing waits on a clock.",
        21
      )
    ]
  },
  /*
   * Out of Reach: a colleague left this from GitHub's own Files changed page, on
   * a line far below the hunks GitHub sends for this file. It has no line here to
   * hang under, so the pane draws it above the file instead of dropping it.
   */
  {
    id: "T-6",
    isResolved: false,
    at: at("src/bun.js/api/server.zig", 2890),
    comments: [
      said(
        "C-9",
        person("dperrault"),
        "While you are in here: this helper still assumes the old flag order, and it is the only other caller.",
        12
      )
    ]
  },
  {
    id: "T-5",
    isResolved: true,
    at: at("src/http.zig", 949),
    comments: [
      said(
        "C-7",
        person("jhalvorsen"),
        "`received_last_chunk` is the field on the state rather than on the client here.",
        120
      ),
      said("C-8", person(VIEWER), "Fixed in the second commit.", 110)
    ]
  }
]

/**
 * What was said about the pull request rather than about a line of it.
 *
 * A deploy notice from a machine, a note from the author, and a benchmark report:
 * three Remarks, which the vocabulary keeps apart from a thread because nobody owes
 * any of them a move. They are here so the conversation panel is a conversation.
 */
const REMARKS: ReadonlyArray<Remark> = [
  {
    id: "R-1",
    author: machine("ci-actions[bot]"),
    body: "**bun-linux-x64** built at 5b2c1a9. Download the canary build from the run summary.",
    html: "<p><strong>bun-linux-x64</strong> built at 5b2c1a9. Download the canary build from the run summary.</p>",
    createdAt: minutesAgo(52)
  },
  {
    id: "R-2",
    author: person("jhalvorsen"),
    body: "Pushed the decoder fix. The abort path is the interesting one, the rest is the test being honest about chunk boundaries.",
    html: "<p>Pushed the decoder fix. The abort path is the interesting one, the rest is the test being honest about chunk boundaries.</p>",
    createdAt: minutesAgo(24)
  },
  {
    id: "R-3",
    author: machine("bench-bot[bot]"),
    body: "http server throughput: 118,402 req/s on main, 119,180 req/s here. No regression outside noise.",
    html: "<p>http server throughput: 118,402 req/s on main, 119,180 req/s here. No regression outside noise.</p>",
    createdAt: minutesAgo(11)
  }
]

const check = (
  name: string,
  state: Check["state"],
  summary: string,
  durationSeconds: number,
  isRequired = true
): Check => ({
  name,
  state,
  isRequired,
  summary,
  // The same run for all of them. No capture follows the address, and a row whose
  // address went nowhere at all would be a row a reader opening the stage by hand
  // could press for nothing.
  url: `https://github.com/${REFERENCE.owner}/${REFERENCE.repo}/actions/runs/19904471382`,
  durationSeconds
})

/**
 * The checks, with one failure among them and two that have not finished.
 *
 * The failure is the point. It is the Attention Item a reader arrives for, and a
 * board of green ticks would be a photograph of the one state where the panel above
 * has nothing to do. The unfinished pair fill Running, which is the Court that means
 * nobody can be asked to hurry.
 */
const CHECKS: ReadonlyArray<Check> = [
  check("linux-x64 / test", "failed", "3 failing tests in test/js/bun/http", 742),
  check("linux-x64 / build", "succeeded", "Built in 6m 12s", 372),
  check("darwin-aarch64 / test", "succeeded", "2,914 passing", 688),
  check("darwin-aarch64 / build", "succeeded", "Built in 4m 41s", 281),
  check("windows-x64 / test", "running", "Running tests", 205),
  check("zig fmt", "succeeded", "No formatting changes", 19),
  check("typecheck", "succeeded", "packages/bun-types is clean", 47),
  check("CodeQL", "queued", "Waiting for a runner", 0, false),
  check("Cirrus CI / linux-x64-baseline", "succeeded", "2,908 passing", 901, false)
]

const REVIEWS: ReadonlyArray<Review> = [
  { reviewer: person("dperrault"), decision: "changes-requested" },
  { reviewer: person("jhalvorsen"), decision: "commented" }
]

const DESCRIPTION = [
  "<p>A <code>ReadableStream</code> response that errors between chunks left the request",
  "context holding the sink, so the next write went onto a socket uWS had already taken",
  "back and the connection was closed under the following keep-alive request.</p>",
  "<p>Three parts: detach the byte stream before rendering over it, hand the pending",
  "stream result to one owner, and stop treating an empty send queue as an ended",
  "socket.</p>",
  "<p>Fixes <a href=\"https://github.com/oven-sh/bun/issues/22988\">#22988</a>.</p>"
].join(" ")

export const SNAPSHOT: PullRequestSnapshot = {
  reference: REFERENCE,
  title: "Keep a keep-alive socket open when a streaming response aborts mid-chunk",
  description: {
    markdown:
      "A `ReadableStream` response that errors between chunks left the request context holding the sink.",
    html: DESCRIPTION
  },
  state: "open",
  openedAt: Option.some(hoursAgo(33)),
  closedAt: Option.none(),
  mergedAt: Option.none(),
      author: person("jhalvorsen"),
  baseBranch: "main",
  headBranch: "serve-abort-mid-chunk",
  // Open, so the branch is still in use and there is nothing to offer about it.
  headRef: { mayDelete: false, mayRestore: false },
  proposal: Option.none(),
  headSha: HEAD_SHA,
  baseSha: BASE_SHA,
  viewer: { login: VIEWER, lastReviewPoint: Option.some(LAST_REVIEW_POINT) },
  files: FILES,
  commits: COMMITS,
  threads: THREADS,
  remarks: REMARKS,
  checks: CHECKS,
  reviews: Option.some(REVIEWS),
  merge: Option.some({
    isMergeable: false,
    blockers: [
      {
        name: "Required checks must pass",
        explanation: `linux-x64 / test failed against ${HEAD_SHA.slice(0, 7)}.`,
        about: Option.some("checks"),
        bypassable: true,
        files: [],
        mayResolve: false
      },
      {
        name: "Changes requested",
        explanation: "dperrault asked for changes and has not reviewed again.",
        about: Option.some("conversation"),
        bypassable: false,
        files: [],
        mayResolve: false
      }
    ],
    queue: Option.none(),
    autoMerge: Option.none(),
    stack: Option.none(),
    /*
     * Behind the branch it would land on, which is one more Attention Item and the
     * only one on the panel that is about the pull request as a whole rather than
     * about something inside it.
     */
    update: Option.some({
      how: "MERGE",
      ways: ["MERGE", "REBASE"],
      mayUpdate: true,
      refusal: Option.none()
    }),
    mayBypass: false,
    channels: [],
    method: Option.some("SQUASH"),
    methods: ["MERGE", "SQUASH", "REBASE"]
  })
}

const LOADED = { snapshot: SNAPSHOT }

/**
 * A remark typed into the panel and not sent, put where the box reads it from.
 *
 * Written through `hold` rather than handed to the screen as a prop, because there is
 * no prop: the box keeps what is unsent in `localStorage` on every keystroke and
 * reads it back when it next stands up, which is the one thing on any of these
 * screens that GitHub has no copy of. Photographing it needs the storage it lives
 * in, and writing it any other way would be photographing something else.
 */
const keepWhatIsUnsent = (): void => {
  hold(
    SUBJECT,
    "The abort path reads right to me. Before I approve: is the HEAD case dperrault asked about covered anywhere, or does that want its own test?"
  )
}

export const PULL_REQUEST_VIEW: View = {
  name: "pull-request",
  caption:
    "One pull request with what is owed on it at the top, so a reviewer reads a list instead of assembling one",
  ...STORE,
  /*
   * A code cell, and deliberately not the host that holds one. See `View.ready`.
   *
   * The host is made at mount, before the renderer has been fetched, so a gate naming
   * it opens on an empty pane: that is the exact false pass that put a file header
   * with nothing under it into three store images. A cell only exists once the diff
   * has been drawn, which is the thing being waited for.
   *
   * The stage's gate searches through shadow roots, which is what makes naming a cell
   * possible at all. The renderer draws into a shadow root of its own, so this never
   * matches a plain `querySelector` from the document.
   */
  ready: "[data-code]",
  draw: () => {
    keepWhatIsUnsent()

    return (
      <PullRequestScreen
        reference={REFERENCE}
        load={settled(LOADED)}
        preload={alreadyKnown(LOADED)}
        recallRepositories={nothingRemembered()}
        fetchDiffs={settled([])}
        /*
         * The whole of each file, so the stage exercises revealing the lines
         * between the hunks with the real renderer rather than a stub.
         */
        readWholeFile={(sha, path) =>
          Effect.succeed(
            UNTOUCHED[path]?.join("\n") ?? wholeOf(path, sha === BASE_SHA ? "before" : "after")
          )
        }
        /*
         * Every path, for bringing in a file the pull request did not change.
         * The changed ones plus a few it did not touch, which is the case the
         * pane exists for.
         */
        readPaths={() =>
          Effect.succeed([
            ...FILES.map((one) => one.path),
            ...Object.keys(UNTOUCHED)
          ])
        }
        onStepAside={() => {}}
        onUseGitHub={() => {}}
        signedIn={() => true}
        /*
         * The writes answer as GitHub answers, with the thing that was written rather
         * than with nothing. Nothing is pressed while a capture is taken, and a
         * callback that returned a stub would be a screen holding a stub the moment
         * somebody opened the stage by hand and pressed one.
         */
        postComment={(note) =>
          Effect.succeed({
            id: `T-${note.path}:${note.lines === null ? "file" : note.lines.line}`,
            isResolved: false,
            // A File Remark comes back anchored to the file and to no line,
            // which is what makes the pane draw it above the diff rather than
            // hang a row somewhere in it.
            at:
              note.lines === null
                ? Option.some({ path: note.path, lines: null })
                : at(note.path, note.lines.line),
            comments: [said("C-said", person(VIEWER), note.body, 0)]
          })
        }
        postRemark={(body) =>
          Effect.succeed({
            id: "R-said",
            author: person(VIEWER),
            body,
            html: `<p>${body}</p>`,
            createdAt: minutesAgo(0)
          })
        }
        onSettle={() => Effect.void}
        onReply={(_commentId, body) =>
          Effect.succeed([said("C-answered", person(VIEWER), body, 0)])
        }
        onReview={() => Effect.void}
        actions={{
          merge: () => Effect.void,
          update: () => Effect.void,
          // Both of the rare ones, so the overflow behind the glyph draws the
          // shape it really has: a draft door and the one press that ends the
          // pull request. Wired to nothing, like the three above it.
          toDraft: () => Effect.void,
          close: () => Effect.void
        }}
      />
    )
  }
}

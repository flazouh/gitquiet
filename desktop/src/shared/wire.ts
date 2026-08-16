/**
 * Everything the two processes say to each other.
 *
 * The only file both sides import, and the reason a typo in a request name is a
 * compile error rather than a promise that never settles.
 *
 * Every shape here is plain JSON on purpose. What travels goes over a socket
 * between two runtimes, so an `Option`, an `Effect` or a `Map` would arrive as
 * an empty object — which is why the interface's own richer types are built from
 * these on arrival rather than sent.
 */

/** Who the token belongs to, as GitHub answers it. */
export type Viewer = {
  readonly login: string
  readonly name: string | null
  readonly avatar: string
}

/**
 * What to put on screen while GitHub waits for the reader to type a code.
 *
 * The device code is handed back to the interface and then handed straight in
 * again to finish. It could have been kept in the main process, but a sign-in
 * that survives a reloaded webview is worth more than a secret that was never
 * one: the device code is single-use, expires in fifteen minutes, and is
 * useless without the reader typing the user code into GitHub themselves.
 */
/**
 * Whether a newer build is waiting, as the five things the window can say.
 *
 * The looking and the downloading happen on launch without being asked, so what
 * crosses the wire is only ever what was found. `off` is a development build,
 * which has no release to compare itself against.
 */
export type UpdateStanding =
  | { readonly at: "off" }
  | { readonly at: "looking" }
  | { readonly at: "current" }
  /** Downloaded, unpacked, and waiting for a restart. */
  | { readonly at: "ready"; readonly version: string }
  | { readonly at: "failed"; readonly why: string }

/**
 * The two ways in, and whether this build can offer each.
 *
 * Both are false in a build nobody gave credentials to, which is the state every
 * release shipped in until the id and the secret were baked in at build time.
 */
export type WaysToSignIn = {
  /** The authorization code flow, through the reader's own browser. */
  readonly browser: boolean
  /** The device flow, for a machine with no browser to open. */
  readonly code: boolean
}

export type Pending = {
  /** The short code the reader types into GitHub. */
  readonly code: string
  /** Where they type it. */
  readonly url: string
  readonly deviceCode: string
  /** Seconds GitHub asks us to wait between polls. */
  readonly interval: number
  readonly expiresIn: number
}

/**
 * An answer that can be no, said in data rather than by throwing.
 *
 * A refusal here is ordinary: a reader closes the GitHub tab, a code expires
 * while they go and find their phone, a network drops. The interface has
 * something to say for each of those, so each arrives as a value it can read.
 */
export type Answered<A> = { readonly ok: true; readonly it: A } | { readonly ok: false; readonly why: string }

/**
 * One row of the Working Set, as facts rather than conclusions.
 *
 * Everything here is something GitHub answered. What it is *not* is a shelf: the
 * shelf is concluded from these by `shelfOf` in the domain, on the other side of
 * this wire, because the conclusion is an `Option` and an `Option` does not
 * survive the crossing. Sending the facts and concluding on arrival also means
 * the rule is tested once and used by both apps rather than reimplemented for
 * whichever process happened to do the asking.
 *
 * The three review facts are the ones worth explaining. GitHub's
 * `review-requested:@me` matches a pull request where either the reader or a
 * team they are on was asked, and `user-review-requested:@me` matches only the
 * reader — so a row in the first and not the second is a team's to pick up, and
 * that difference is the whole of `askedOfTeam`. No organisation scope is
 * needed to work it out, which is the reason for doing it this way round.
 */
export type WorkingSetRow = {
  /** GitHub's numeric id, which is what the interface keys rows by. */
  readonly id: number
  readonly owner: string
  readonly repo: string
  readonly number: number
  readonly title: string
  readonly authorLogin: string
  readonly authorIsBot: boolean
  readonly authorFaceUrl: string | null
  readonly state: "open" | "closed" | "merged" | "draft"
  readonly readByViewer: boolean
  readonly comments: number
  readonly labels: number
  readonly assignees: number
  readonly openedAt: string
  readonly changedAt: string
  readonly headSha: string
  readonly added: number
  readonly deleted: number
  readonly baseBranch: string
  readonly headBranch: string
  /** Null where the pull request has no checks configured, not where none arrived. */
  readonly checks: {
    readonly state: "passing" | "failing" | "running"
    readonly total: number
    readonly passed: number
  } | null
  readonly reviewed: "approved" | "changes-requested" | "review-required" | null
  readonly viewerIsAuthor: boolean
  /** Asked of the reader by name. */
  readonly askedOfViewer: boolean
  /** Asked of a team the reader is on, and not of the reader by name. */
  readonly askedOfTeam: boolean
  readonly inMergeQueue: boolean
}

/** Which pull request a request is about. */
export type Card = {
  readonly owner: string
  readonly repo: string
  readonly number: number
}

/** Somebody, as GitHub names them. `null` where the account is gone. */
export type FaceFacts = {
  readonly login: string
  readonly isAutomated: boolean
  readonly faceUrl: string | null
}

/**
 * One changed file, and where its content is.
 *
 * `patch` is unified diff text, which is how the documented API hands content over,
 * and is read into lines by `fromPatch` on the other side. It is absent far more
 * often than it is present, for three different reasons that the interface has to
 * draw differently — so `content` says which, rather than leaving a `null` to be
 * guessed at:
 *
 * - `here`: the patch is on this object.
 * - `unasked`: GitHub has one and this did not carry it. Ask for it by path.
 * - `withheld`: GitHub sends no patch for this file, being too large a change.
 * - `binary`: there are no lines to send.
 */
export type FileFacts = {
  readonly path: string
  readonly digest: string
  readonly changeType: "added" | "modified" | "deleted" | "renamed" | "copied" | "changed"
  readonly linesAdded: number
  readonly linesDeleted: number
  readonly readByViewer: boolean
  readonly content: "here" | "unasked" | "withheld" | "binary"
  readonly patch: string | null
}

export type CommitFacts = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly author: string
  readonly headline: string
  readonly createdAt: string
}

/**
 * One commit with its files, for the panel that opens beside the pull request.
 *
 * Same file facts the card uses, so the shared file browser draws it without
 * knowing which of the two it is reading.
 */
export type CommitDetailFacts = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly headline: string
  readonly bodyHtml: string | null
  readonly author: string
  readonly avatarUrl: string | null
  readonly createdAt: string
  readonly files: ReadonlyArray<FileFacts>
}

export type SaidFacts = {
  readonly author: FaceFacts
  readonly body: string
  readonly html: string
  readonly createdAt: string
}

export type ThreadFacts = {
  readonly id: string
  readonly isResolved: boolean
  /** Absent on a thread GitHub could no longer place in the diff. */
  readonly at: {
    readonly path: string
    readonly side: "before" | "after"
    readonly line: number
    readonly startLine: number
  } | null
  readonly comments: ReadonlyArray<SaidFacts>
}

export type RemarkFacts = SaidFacts & { readonly id: string }

export type CheckFacts = {
  readonly name: string
  readonly state: "succeeded" | "failed" | "running" | "queued" | "cancelled" | "skipped" | "neutral"
  readonly isRequired: boolean
  readonly summary: string
  readonly url: string
  readonly durationSeconds: number
}

export type ReviewFacts = {
  readonly reviewer: FaceFacts
  readonly decision: "approved" | "changes-requested" | "commented" | "dismissed"
}

/**
 * What GitHub says about landing this, in the words the documented API uses.
 *
 * `status` is `mergeStateStatus` verbatim, and the blockers a reader sees are
 * concluded from it on the other side of the wire rather than here, for the same
 * reason the shelves are: a conclusion is the interface's to draw, and the rule is
 * worth testing once. GitHub's own page can name the individual rule that failed;
 * the documented API cannot, and this does not pretend otherwise.
 */
export type MergeFacts = {
  readonly mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN"
  readonly status: string
  readonly mayBypass: boolean
  readonly mayUpdateBranch: boolean
  readonly whyNotUpdate: ReadonlyArray<string>
  readonly autoMerge: { readonly method: string | null; readonly mayCancel: boolean } | null
  readonly queue: {
    readonly waiting: boolean
    readonly position: number | null
    readonly mayQueue: boolean
    readonly url: string | null
  } | null
}

/**
 * A whole pull request card, as facts.
 *
 * The same JSON-only rule as everything else here, which is why every `Option` in
 * `PullRequestSnapshot` is a `null` in its counterpart field: the snapshot is built
 * from this on arrival by `snapshotFrom`.
 */
export type CardFacts = {
  readonly title: string
  readonly markdown: string
  readonly html: string
  readonly state: "open" | "closed" | "merged" | "draft"
  readonly openedAt: string | null
  readonly closedAt: string | null
  readonly mergedAt: string | null
  readonly author: FaceFacts
  readonly baseBranch: string
  readonly headBranch: string
  readonly headSha: string
  readonly baseSha: string
  readonly viewerLogin: string
  /** The commit of the reader's own last review, when they have written one. */
  readonly lastReviewPoint: string | null
  readonly files: ReadonlyArray<FileFacts>
  readonly commits: ReadonlyArray<CommitFacts>
  readonly threads: ReadonlyArray<ThreadFacts>
  readonly remarks: ReadonlyArray<RemarkFacts>
  readonly checks: ReadonlyArray<CheckFacts>
  readonly reviews: ReadonlyArray<ReviewFacts>
  readonly merge: MergeFacts
}

/**
 * Something a reader has asked to happen to a pull request.
 *
 * The domain's own eight verbs, in the shape a socket can carry: a tag and, for
 * the three that need one, the way of doing it. Not a method name and an argument
 * list, because a name that arrived misspelled would be a request the main process
 * has to decide what to do with, and a tag that arrived misspelled does not
 * compile.
 *
 * `SOLO` is in the type because the port has it and is refused by the reader in
 * the main process: the documented mutation for joining a queue takes `jump` and
 * nothing else, so there is no way to ask GitHub for a pull request that merges
 * alone. Refused out loud rather than quietly queued the ordinary way.
 */
export type Asked =
  | { readonly doing: "merge"; readonly method: "MERGE" | "SQUASH" | "REBASE" }
  | { readonly doing: "enqueue"; readonly how: "GROUP" | "SOLO" }
  | { readonly doing: "updateBranch"; readonly how: "MERGE" | "REBASE" }
  | { readonly doing: "close" }
  | { readonly doing: "reopen" }
  | { readonly doing: "markReady" }
  | { readonly doing: "toDraft" }
  | { readonly doing: "dequeue" }
  | { readonly doing: "cancelAutoMerge" }

export type Wire = {
  bun: {
    requests: {
      /** Who is already signed in, from the token the keychain is holding. */
      viewer: { params: void; response: Viewer | null }
      /**
       * Which sign-ins this build was given credentials for.
       *
       * Asked before the panel draws, so it never offers a button that cannot
       * work. Answered from two constants with nothing over the network: the
       * browser flow needs the client secret GitHub asks for at the token
       * endpoint, the code flow needs only the client id.
       */
      waysToSignIn: { params: void; response: WaysToSignIn }
      /**
       * Opens the reader's own browser, waits for them there, keeps the token.
       *
       * One request rather than two, because nothing has to be shown while it
       * runs: the reader is looking at github.com, and this answers when they
       * come back.
       */
      signInThroughBrowser: { params: void; response: Answered<Viewer> }
      /** Asks GitHub for a code pair and hands back what to show the reader. */
      beginSignIn: { params: void; response: Answered<Pending> }
      /** Waits for GitHub to say the reader typed it, then keeps the token. */
      finishSignIn: { params: Pending; response: Answered<Viewer> }
      /** Forgets the token, which is the whole of signing out. */
      signOut: { params: void; response: void }
      /**
       * Whether a newer build is already downloaded and waiting.
       *
       * Asked rather than pushed, because the check starts before the window
       * exists. Answered with `looking` while it is still going, which is the
       * one answer worth asking again after.
       */
      updateStanding: { params: void; response: UpdateStanding }
      /**
       * Restarts into the build that was downloaded.
       *
       * Nothing comes back: this process replaces the bundle and quits, and the
       * window that asked is gone before an answer could reach it.
       */
      applyUpdate: { params: void; response: void }
      /** Every pull request the reader is in, in one GraphQL round trip. */
      workingSet: { params: void; response: Answered<ReadonlyArray<WorkingSetRow>> }
      /** One pull request, whole: everything its card draws except file content. */
      card: { params: Card; response: Answered<CardFacts> }
      /**
       * The content of some files, for a card already on screen.
       *
       * Asked for by path rather than fetched with the card, because a pull request
       * of two hundred files is two hundred patches and a reader opens four of them.
       */
      patches: {
        params: Card & { readonly paths: ReadonlyArray<string> }
        response: Answered<ReadonlyArray<{ readonly path: string; readonly patch: string | null }>>
      }
      /**
       * One commit of the repository, with the files it changed.
       *
       * Asked by sha rather than by pull request number: a commit belongs to
       * the repo, and the panel that shows it only needs the owner/repo/sha.
       */
      commit: {
        params: { readonly owner: string; readonly repo: string; readonly sha: string }
        response: Answered<CommitDetailFacts>
      }
      /**
       * Something done to a pull request rather than read from it.
       *
       * One request for all eight verbs. A refusal is data like every other answer
       * here, because a refused write is the ordinary case: a branch that moved, a
       * rule the reader cannot go past, a queue that closed while they were
       * reading. The card prints what GitHub said.
       */
      write: { params: Card & { readonly asked: Asked }; response: Answered<void> }
      /**
       * Something opened outside this window, in whatever the reader browses with.
       *
       * The webview must never navigate. It is the interface — there is no address
       * bar, no back button and no tab to close — so a link that took it to
       * github.com left the reader inside a browser with none of the parts of one,
       * and the only way back was to quit. Every outward link is therefore handed
       * to the main process, which knows how to ask the system.
       */
      openOutside: { params: { readonly url: string }; response: Answered<void> }
      /**
       * The window, made bigger or put back.
       *
       * Asked for from the interface because the title strip is ours: the webview
       * covers the whole window, so the double-click that zooms a window on macOS
       * lands on our markup rather than on a title bar, and the only place that can
       * hear it is the interface. `zoom` is what that double-click means — fill the
       * screen, or go back to the size it was — and `fullScreen` is the other thing,
       * where the menu bar goes away too.
       *
       * Both toggle, and both answer with what the window now is, so a menu that
       * says "Full screen" can say "Leave full screen" without asking again.
       */
      shapeWindow: {
        params: { readonly how: "zoom" | "fullScreen" }
        response: Answered<{ readonly maximized: boolean; readonly fullScreen: boolean }>
      }
      /**
       * Page zoom for the webview (Cmd+/−/0), not window maximize.
       *
       * WebKit's page zoom lives on the main-process window handle. The view
       * hears the keys and asks here, so both halves share one zoom level.
       */
      pageZoom: {
        params: { readonly how: "in" | "out" | "reset" }
        response: Answered<{ readonly zoom: number }>
      }
      /**
       * A remark on some lines, which becomes a review thread.
       *
       * The head sha travels with it because a line comment is against a commit,
       * not against a pull request: the card knows which one it drew the diff for,
       * and a reader who has been reading while somebody pushed should have their
       * comment refused rather than quietly hung on a different line.
       */
      sayOnLines: {
        params: Card & {
          readonly path: string
          readonly line: number
          readonly startLine: number
          readonly body: string
          readonly headSha: string
        }
        response: Answered<ThreadFacts>
      }
      /** A remark on the pull request itself, which hangs on no line. */
      sayOnThePullRequest: {
        params: Card & { readonly body: string }
        response: Answered<RemarkFacts>
      }
    }
    messages: Record<string, never>
  }
  webview: {
    requests: Record<string, never>
    messages: Record<string, never>
  }
}

import { Schema } from "effect"

/**
 * The shape of GitHub's internal pull request payloads, modelling only the
 * fields we consume. Excess fields are ignored, so GitHub adding to a payload
 * is not drift; removing or renaming what we read is, and fails here by name.
 *
 * Enumerations are strict on purpose. A review decision or check state we do
 * not recognise must fail loudly, because quietly mapping it to a neighbouring
 * value would hide a blocking review or a failing check.
 */

const Author = Schema.Struct({
  login: Schema.String,
  isAgent: Schema.optional(Schema.NullOr(Schema.Boolean)),
  avatarUrl: Schema.optional(Schema.NullOr(Schema.String))
})

const AutomatedComment = Schema.Struct({
  aiAuthored: Schema.Boolean
})

const ThreadComment = Schema.Struct({
  author: Schema.NullOr(Author),
  body: Schema.String,
  bodyHTML: Schema.String,
  createdAt: Schema.String,
  automatedComment: Schema.optional(Schema.NullOr(AutomatedComment))
})

export const CreatedComment = Schema.Struct({
  thread: Schema.Struct({
    id: Schema.String,
    isResolved: Schema.Boolean,
    commentsData: Schema.Struct({
      comments: Schema.Array(
        Schema.Struct({
          author: Schema.Struct({
            login: Schema.String,
            avatarUrl: Schema.optional(Schema.NullOr(Schema.String))
          }),
          body: Schema.String,
          bodyHTML: Schema.String,
          createdAt: Schema.String
        })
      )
    })
  })
})

const Thread = Schema.Struct({
  id: Schema.String,
  isResolved: Schema.Boolean,
  commentsData: Schema.Struct({
    comments: Schema.Array(ThreadComment)
  })
})

/**
 * Where a file's review threads hang, keyed by the line they hang from.
 *
 * The key is a side and a line together — `R105` is line 105 of the new file,
 * `L27` line 27 of the old — and `start` names the first line when the remark
 * covers a range. This is the only place in the payload that says which file a
 * thread belongs to: the threads themselves, over in `markers`, do not.
 */
const Markers = Schema.Record(
  Schema.String,
  Schema.Struct({
    threads: Schema.Array(
      Schema.Struct({
        id: Schema.Number,
        start: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  })
)

const DiffSummary = Schema.Struct({
  path: Schema.String,
  pathDigest: Schema.String,
  markersMap: Schema.optional(Markers),
  // REMOVED is what GitHub actually sends for a deleted file on this route.
  // DELETED is kept beside it because it is the name their GraphQL schema uses
  // for the same thing, and one of the two routes changing its mind is likelier
  // than both.
  changeType: Schema.Literals([
    "ADDED",
    "MODIFIED",
    "REMOVED",
    "DELETED",
    "RENAMED",
    "COPIED",
    "CHANGED"
  ]),
  linesAdded: Schema.Number,
  linesDeleted: Schema.Number,
  markedAsViewed: Schema.Boolean
})

const DiffLine = Schema.Struct({
  type: Schema.Literals(["HUNK", "CONTEXT", "ADDITION", "DELETION"]),
  text: Schema.String,
  left: Schema.NullOr(Schema.Number),
  right: Schema.NullOr(Schema.Number)
})

const DiffContent = Schema.Struct({
  path: Schema.String,
  isBinary: Schema.Boolean,
  isTooBig: Schema.Boolean,
  truncatedReason: Schema.NullOr(Schema.String),
  diffLines: Schema.Array(DiffLine)
})

/**
 * The diffs GitHub holds back, asked for by name.
 *
 * A pull request page arrives with content for the first few files only — five
 * of thirty-three on a real one — and their own Files tab fetches the rest in
 * batches as they are scrolled to. The answer is a bare array of exactly the
 * shape the page embeds, so the same decoding serves both.
 */
export const DiffEntriesRoute = Schema.Array(DiffContent)

export type DiffEntriesRoute = typeof DiffEntriesRoute["Type"]

const Commit = Schema.Struct({
  oid: Schema.String,
  shortOid: Schema.String,
  actorLogin: Schema.NullOr(Schema.String),
  messageHeadline: Schema.String,
  createdAt: Schema.String
})

/**
 * One file of a commit, whether or not its content came with the page.
 *
 * GitHub embeds content for as many files as fits a byte budget — six to
 * fourteen on the commits of one real pull request — and sends every file after
 * that as these three fields alone. Everything else is optional because a
 * held-back file has none of it, not even its line counts, and a schema that
 * insisted would throw away the whole commit over the first file GitHub decided
 * not to send twice.
 */
const CommitDiffEntry = Schema.Struct({
  path: Schema.String,
  pathDigest: Schema.String,
  status: Schema.Literals([
    "ADDED",
    "MODIFIED",
    "REMOVED",
    "DELETED",
    "RENAMED",
    "COPIED",
    "CHANGED"
  ]),
  linesAdded: Schema.optional(Schema.Number),
  linesDeleted: Schema.optional(Schema.Number),
  isBinary: Schema.optional(Schema.Boolean),
  isTooBig: Schema.optional(Schema.Boolean),
  truncatedReason: Schema.optional(Schema.NullOr(Schema.String)),
  diffLines: Schema.optional(Schema.Array(DiffLine))
})

export type CommitDiffEntry = typeof CommitDiffEntry["Type"]

/**
 * Where GitHub stopped embedding, and what to say to be given more.
 *
 * `startIndex` is the first file sent without content, and the byte and line
 * counts are what has been spent so far — their own page hands all three
 * straight back on the next request, so they are a cursor rather than a
 * measurement.
 */
const AsyncDiffLoad = Schema.Struct({
  startIndex: Schema.Number,
  byteCount: Schema.Number,
  lineShownCount: Schema.Number
})

export type AsyncDiffLoad = typeof AsyncDiffLoad["Type"]

/**
 * One commit, from the page GitHub serves for it.
 *
 * The diff entries are the same shape the pull request embeds, down to the line
 * records — one route's `status` where the other says `changeType`, and the
 * rest identical — so everything downstream of here is shared.
 */
export const CommitRoute = Schema.Struct({
  payload: Schema.Struct({
    commit: Schema.Struct({
      oid: Schema.String,
      authoredDate: Schema.String,
      // This commit and the one it is a diff against, which is what their route
      // for the held-back files is keyed by. Absent on a root commit, which has
      // nothing before it to compare with.
      sha1: Schema.optional(Schema.NullOr(Schema.String)),
      sha2: Schema.optional(Schema.NullOr(Schema.String)),
      // Null on some commits, where the headline only exists as the rendered
      // markdown beside it — a merge commit made through their web interface is
      // one. Both are optional here and the mapper takes whichever came.
      shortMessage: Schema.optional(Schema.NullOr(Schema.String)),
      shortMessageMarkdown: Schema.optional(Schema.NullOr(Schema.String)),
      bodyMessageHtml: Schema.optional(Schema.NullOr(Schema.String)),
      authors: Schema.Array(
        Schema.Struct({
          login: Schema.optional(Schema.NullOr(Schema.String)),
          displayName: Schema.optional(Schema.NullOr(Schema.String)),
          avatarUrl: Schema.optional(Schema.NullOr(Schema.String))
        })
      )
    }),
    asyncDiffLoadInfo: Schema.optional(Schema.NullOr(AsyncDiffLoad)),
    moreDiffsToLoad: Schema.optional(Schema.Boolean),
    diffEntryData: Schema.Array(CommitDiffEntry)
  })
})

export type CommitRoute = typeof CommitRoute["Type"]

/**
 * The files a commit page held back, one batch at a time.
 *
 * Their own page asks for these as it is scrolled. There is no way to ask for a
 * file by name — a `paths` parameter is accepted and ignored — so this walks
 * forward from the cursor the last answer gave, and `loadMore` says whether
 * there is another batch behind it.
 */
export const CommitDiffsRoute = Schema.Struct({
  extraDiffEntries: Schema.Array(CommitDiffEntry),
  loadMore: Schema.Boolean,
  asyncDiffLoadInfo: Schema.optional(Schema.NullOr(AsyncDiffLoad))
})

export type CommitDiffsRoute = typeof CommitDiffsRoute["Type"]

/**
 * The pull request body, from the route that serves it alone.
 *
 * Both forms are kept: the markdown because it is the text the Author wrote,
 * and GitHub's own rendering of it because reproducing their markdown — task
 * lists, suggestions, mentions, emoji, the lot — is a project, and they have
 * already done it.
 */
export const DescriptionRoute = Schema.Struct({
  body: Schema.String,
  bodyHtml: Schema.String
})

export type DescriptionRoute = typeof DescriptionRoute["Type"]

export const ChangesRoute = Schema.Struct({
  payload: Schema.Struct({
    pullRequestsChangesRoute: Schema.Struct({
      pullRequest: Schema.Struct({
        number: Schema.Number,
        title: Schema.String,
        state: Schema.Literals(["OPEN", "CLOSED", "MERGED", "DRAFT"]),
        author: Schema.NullOr(Author),
        baseBranch: Schema.String,
        headBranch: Schema.String,
        commitsCount: Schema.Number
      }),
      user: Schema.Struct({
        currentUserLogin: Schema.NullOr(Schema.String),
        lastReviewOid: Schema.NullOr(Schema.String)
      }),
      comparison: Schema.Struct({
        fullDiff: Schema.Struct({
          baseOid: Schema.String,
          headOid: Schema.String
        })
      }),
      diffSummaries: Schema.Array(DiffSummary),
      diffContents: Schema.Array(DiffContent),
      commits: Schema.Array(Commit),
      markers: Schema.Struct({
        threads: Schema.Record(Schema.String, Thread)
      })
    })
  })
})

export type ChangesRoute = typeof ChangesRoute["Type"]

export const StatusChecksRoute = Schema.Struct({
  statusChecks: Schema.Array(
    Schema.Struct({
      displayName: Schema.String,
      description: Schema.NullOr(Schema.String),
      state: Schema.Literals([
        "SUCCESS",
        "FAILURE",
        "ERROR",
        "PENDING",
        "IN_PROGRESS",
        "QUEUED",
        "WAITING",
        "REQUESTED",
        "EXPECTED",
        "ACTION_REQUIRED",
        "CANCELLED",
        "TIMED_OUT",
        "STARTUP_FAILURE",
        "STALE",
        "NEUTRAL",
        "SKIPPED"
      ]),
      isRequired: Schema.Boolean,
      targetUrl: Schema.NullOr(Schema.String),
      durationInSeconds: Schema.Number
    })
  )
})

export type StatusChecksRoute = typeof StatusChecksRoute["Type"]

/**
 * The queue half of the merge box, all of it optional.
 *
 * Every field here is absent or null on a repository that merges directly, and
 * both recordings are from one — so a schema that insisted on them would fail
 * to decode the payloads this route actually returns most of the time. Optional
 * is not laziness: it is the difference between a repository without a queue
 * and a payload that changed shape.
 */
const MergeQueueEntry = Schema.Struct({
  position: Schema.optional(Schema.NullOr(Schema.Number)),
  state: Schema.optional(Schema.NullOr(Schema.String))
})

const MergeQueue = Schema.Struct({
  url: Schema.optional(Schema.NullOr(Schema.String))
})

/**
 * GitHub's own verdict on each way of merging, which is not the same question
 * as whether the Participant is allowed to merge.
 *
 * One entry per way in — `MERGE_QUEUE`, `DIRECT_MERGE`, `AUTO_MERGE` — each
 * carrying `ALLOWED` or `BLOCKED` and the methods it would accept. A repository
 * with a queue answers `MERGE_QUEUE: ALLOWED` and `DIRECT_MERGE: BLOCKED`, and
 * a pull request that cannot go into that queue yet answers `BLOCKED` for both.
 * It is the field their own button reads, and it says in one place what would
 * otherwise be assembled from a permission flag and a pile of conditions.
 */
const MergeAction = Schema.Struct({
  name: Schema.String,
  allowableStatus: Schema.optional(Schema.NullOr(Schema.String))
})

/**
 * The signed tokens GitHub's own page subscribes to for this merge box.
 *
 * One per topic, and null for the ones that do not apply — a repository
 * without a queue has no queue channel. Only the ones this card would act on
 * are named; the payload carries several more.
 */
const AliveChannels = Schema.Struct({
  mergeQueueChannel: Schema.optional(Schema.NullOr(Schema.String)),
  gitMergeStateChannel: Schema.optional(Schema.NullOr(Schema.String)),
  reviewStateChannel: Schema.optional(Schema.NullOr(Schema.String)),
  stateChannel: Schema.optional(Schema.NullOr(Schema.String)),
  workflowsChannel: Schema.optional(Schema.NullOr(Schema.String)),
  pullRequestChannel: Schema.optional(Schema.NullOr(Schema.String))
})

/**
 * One way of catching a branch up with its base, and GitHub's verdict on it.
 *
 * Shaped like a merge action, and read the same way: the name is what the
 * write would send, and the reason is why it would be refused.
 */
const UpdateMethod = Schema.Struct({
  name: Schema.String,
  allowableStatus: Schema.optional(Schema.NullOr(Schema.String)),
  isDefault: Schema.optional(Schema.NullOr(Schema.Boolean)),
  failureReason: Schema.optional(Schema.NullOr(Schema.String))
})

/**
 * A merge GitHub is holding until the pull request is allowed to take it.
 *
 * Present on a repository with a queue as well as one without: "merge when
 * ready" and "enable auto-merge" are the same request, and this is what both
 * leave behind.
 */
const AutoMergeRequest = Schema.Struct({
  mergeMethod: Schema.optional(Schema.NullOr(Schema.String))
})

/**
 * One rule inside a failed condition, which is where `bypassable` lives.
 *
 * GitHub reports whether a rule may be gone past per rule, not per condition,
 * because a repository can have one ruleset an administrator may override and
 * another nobody may.
 */
const RuleRollup = Schema.Struct({
  result: Schema.String,
  /** Which rule it is, e.g. `REQUIRED_STATUS_CHECKS`. */
  ruleType: Schema.optional(Schema.NullOr(Schema.String)),
  bypassable: Schema.optional(Schema.NullOr(Schema.Boolean))
})

export const MergeBoxRoute = Schema.Struct({
  pullRequest: Schema.Struct({
    latestOpinionatedReviews: Schema.Array(
      Schema.Struct({
        author: Schema.NullOr(Author),
        state: Schema.Literals([
          "APPROVED",
          "CHANGES_REQUESTED",
          "COMMENTED",
          "DISMISSED",
          "PENDING"
        ])
      })
    ),
    isInMergeQueue: Schema.optional(Schema.NullOr(Schema.Boolean)),
    mergeQueue: Schema.optional(Schema.NullOr(MergeQueue)),
    mergeQueueEntry: Schema.optional(Schema.NullOr(MergeQueueEntry)),
    viewerCanAddAndRemoveFromMergeQueue: Schema.optional(Schema.NullOr(Schema.Boolean)),
    viewerMergeActions: Schema.optional(Schema.NullOr(Schema.Array(MergeAction))),
    autoMergeRequest: Schema.optional(Schema.NullOr(AutoMergeRequest)),
    mergeStateStatus: Schema.optional(Schema.NullOr(Schema.String)),
    mergeBoxAliveChannels: Schema.optional(Schema.NullOr(AliveChannels)),
    viewerUpdateMethods: Schema.optional(Schema.NullOr(Schema.Array(UpdateMethod))),
    viewerCanDisableAutoMerge: Schema.optional(Schema.NullOr(Schema.Boolean)),
    viewerCanAdminBypassMergeRequirements: Schema.optional(Schema.NullOr(Schema.Boolean))
  }),
  /**
   * Null once the pull request has landed, which is GitHub saying there is
   * nothing left to require rather than that they forgot. Refusing the payload
   * over it failed the whole read, and a failed read shows whatever was last
   * remembered — a merged pull request still calling itself open.
   */
  mergeRequirements: Schema.NullOr(
    Schema.Struct({
      state: Schema.String,
      conditions: Schema.Array(
        Schema.Struct({
          displayName: Schema.String,
          description: Schema.String,
          result: Schema.String,
          /** GitHub's own name for the kind of condition, e.g. `PULL_REQUEST_RULES`. */
          type: Schema.optional(Schema.NullOr(Schema.String)),
          /**
           * What GitHub decided, as against what the rule requires.
           *
           * `description` is fixed text belonging to the rule — "Pull request
           * repository rules" — and reads identically on every pull request
           * that ever failed it. This is the sentence naming the thing that is
           * actually wrong, and it arrives as a fragment of HTML.
           */
          message: Schema.optional(Schema.NullOr(Schema.String)),
          ruleRollups: Schema.optional(Schema.NullOr(Schema.Array(RuleRollup)))
        })
      )
    })
  )
})

export type MergeBoxRoute = typeof MergeBoxRoute["Type"]

/**
 * One pull request of the Working Set, as the dashboard's own routes serve it.
 *
 * Twenty-six fields arrive and these are the ones worth reading. Two of the
 * absent ones are worth naming, because they look like the answer to stacking
 * and are not: `stackPosition` and `stackSize` come back null even for a real
 * three-deep chain, so they describe a stacking of GitHub's own rather than the
 * ordinary kind. Stacks are found from base and head branches instead, which
 * this row does not carry at all — see `src/domain/stacks.ts`.
 */
const WorkingSetRow = Schema.Struct({
  /** GitHub's own numeric id, which is what the deferred route is keyed by. */
  id: Schema.Number,
  number: Schema.Number,
  title: Schema.String,
  /** `owner/repo`, since the Working Set crosses repositories. */
  repoNameWithOwner: Schema.String,
  permalink: Schema.String,
  /**
   * Only the login arrives, not the avatar. That is enough: an avatar URL is
   * built from a login, which `faceOf` already does for every other face here.
   */
  author: Schema.NullOr(Schema.Struct({ displayLogin: Schema.String })),
  /** Whether an agent opened it, which is what a Participant's automated flag is. */
  authoredByAgent: Schema.optional(Schema.NullOr(Schema.Boolean)),
  state: Schema.Literals(["OPEN", "CLOSED", "MERGED", "DRAFT"]),
  isDraft: Schema.Boolean,
  isReadByCurrentUser: Schema.Boolean,
  commentCount: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  headSha: Schema.String,
  /**
   * Why GitHub thinks this needs attention — `CI_FAILING`, `MERGE_CONFLICTS`,
   * `WAITING_FOR_REVIEW`, `CI_RUNNING`, `READY_TO_MERGE` are the five seen so
   * far, and only on the shelf routes: a plain query leaves it null.
   *
   * A string rather than a union, against the rule at the top of this file, and
   * for a reason the rule allows. Five distinct values turned up in sixteen
   * rows, so the set is certainly larger than anything observation can close,
   * and an unrecognised one here hides nothing: the Court is decided by which
   * shelf the row came from, never by this. Refusing the payload over it would
   * blank the entire Working Set rather than one field of one row.
   */
  category: Schema.optional(Schema.NullOr(Schema.String)),
  /** Alive token for this row's head commit, for watching a list go green. */
  commitHeadShaChannel: Schema.optional(Schema.NullOr(Schema.String)),
  /**
   * Both were empty in every row observed, so their element shape is unknown
   * and nothing here reads it. Counted, not decoded: guessing the shape is how
   * the first pull request carrying a label would fail the whole read.
   */
  labels: Schema.Array(Schema.Unknown),
  assignees: Schema.Array(Schema.Unknown)
})

export type WorkingSetRow = typeof WorkingSetRow["Type"]

const Listing = Schema.Struct({
  results: Schema.Array(WorkingSetRow),
  pageInfo: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        currentPage: Schema.Number,
        totalPages: Schema.Number,
        totalCount: Schema.Number
      })
    )
  )
})

/**
 * One of GitHub's six shelves, from `/pulls/inbox/queries?filter=…`.
 *
 * The same rows as {@link QueryRoute} under a different key, which is GitHub's
 * arrangement and not one worth hiding: the shelf route is the only one that
 * fills in `category`, so which key a payload came under says what is in it.
 */
export const ShelfRoute = Schema.Struct({
  payload: Schema.Struct({ pullsInboxSurfaceContentRoute: Listing })
})

export type ShelfRoute = typeof ShelfRoute["Type"]

/** An arbitrary search, from `/pulls?q=…`. Carries no `category`. */
export const QueryRoute = Schema.Struct({
  payload: Schema.Struct({ pullsDashboardSurfaceContentRoute: Listing })
})

export type QueryRoute = typeof QueryRoute["Type"]

/**
 * What the rows arrive without: how the checks stand, and how the reviews did.
 *
 * GitHub's own dashboard fetches this straight after the rows, batched nine ids
 * at a time, because neither fact is on a row. Which makes an attention-aware
 * Working Set two requests rather than one per pull request.
 */
export const DeferredRoute = Schema.Struct({
  payload: Schema.Struct({
    pullsInboxSurfaceContentDeferredData: Schema.Struct({
      results: Schema.Array(
        Schema.Struct({
          id: Schema.Number,
          /**
           * Absent altogether on a pull request with no checks at all, which one
           * observed row was — hence optional rather than merely nullable.
           */
          statusCheckRollup: Schema.optional(
            Schema.NullOr(
              Schema.Struct({
                /**
                 * `SUCCESS` and `FAILURE` are the two observed. The rest are
                 * GitHub's published `StatusState`, which this field is typed as
                 * in their own schema, and `CI_RUNNING` turning up as a category
                 * says `PENDING` is reachable.
                 */
                state: Schema.Literals(["SUCCESS", "FAILURE", "PENDING", "ERROR", "EXPECTED"]),
                totalCount: Schema.Number,
                successCount: Schema.Number
              })
            )
          ),
          /** Null until anybody has given an opinion, which is most of them. */
          reviewDecisionState: Schema.optional(
            Schema.NullOr(
              Schema.Literals(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"])
            )
          ),
          approvedReviewsCount: Schema.optional(Schema.NullOr(Schema.Number)),
          changesRequestedReviewsCount: Schema.optional(Schema.NullOr(Schema.Number))
        })
      )
    })
  })
})

export type DeferredRoute = typeof DeferredRoute["Type"]

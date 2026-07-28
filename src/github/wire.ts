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
    diffEntryData: Schema.Array(
      Schema.Struct({
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
        linesAdded: Schema.Number,
        linesDeleted: Schema.Number,
        isBinary: Schema.Boolean,
        isTooBig: Schema.Boolean,
        truncatedReason: Schema.optional(Schema.NullOr(Schema.String)),
        diffLines: Schema.Array(DiffLine)
      })
    )
  })
})

export type CommitRoute = typeof CommitRoute["Type"]

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
  reviewStateChannel: Schema.optional(Schema.NullOr(Schema.String))
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
  mergeRequirements: Schema.Struct({
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
         * repository rules" — and reads identically on every pull request that
         * ever failed it. This is the sentence naming the thing that is
         * actually wrong, and it arrives as a fragment of HTML.
         */
        message: Schema.optional(Schema.NullOr(Schema.String)),
        ruleRollups: Schema.optional(Schema.NullOr(Schema.Array(RuleRollup)))
      })
    )
  })
})

export type MergeBoxRoute = typeof MergeBoxRoute["Type"]

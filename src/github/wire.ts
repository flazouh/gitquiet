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
  isAgent: Schema.optional(Schema.NullOr(Schema.Boolean))
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

const Thread = Schema.Struct({
  id: Schema.String,
  isResolved: Schema.Boolean,
  commentsData: Schema.Struct({
    comments: Schema.Array(ThreadComment)
  })
})

const DiffSummary = Schema.Struct({
  path: Schema.String,
  pathDigest: Schema.String,
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
    viewerCanAddAndRemoveFromMergeQueue: Schema.optional(Schema.NullOr(Schema.Boolean))
  }),
  mergeRequirements: Schema.Struct({
    state: Schema.String,
    conditions: Schema.Array(
      Schema.Struct({
        displayName: Schema.String,
        description: Schema.String,
        result: Schema.String
      })
    )
  })
})

export type MergeBoxRoute = typeof MergeBoxRoute["Type"]

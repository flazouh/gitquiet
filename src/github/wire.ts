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

const Commit = Schema.Struct({
  oid: Schema.String,
  shortOid: Schema.String,
  actorLogin: Schema.NullOr(Schema.String),
  messageHeadline: Schema.String,
  createdAt: Schema.String
})

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
    )
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

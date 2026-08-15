import { Schema } from "effect"
import * as SchemaIssue from "effect/SchemaIssue"

/**
 * The shape of GitHub's internal pull request payloads, modelling only the
 * fields we consume. Excess fields are ignored, so GitHub adding to a payload
 * is not drift; removing or renaming what we read is, and fails here by name.
 *
 * Enumerations are strict on purpose. A review decision or check state we do
 * not recognise must fail loudly, because quietly mapping it to a neighbouring
 * value would hide a blocking review or a failing check.
 */

const sayIssue = SchemaIssue.makeFormatterStandardSchemaV1()

/**
 * Which field of a payload would not decode, and what arrived there instead.
 *
 * A refusal from one of these schemas stringifies to `"Error"` and nothing else,
 * so every tool that reported one — the drift check, the diagnoser — printed a
 * stack trace through Effect's internals and left the reader to guess. Two shape
 * changes on one live pull request cost an hour of guessing before this existed.
 * Anything that is not a schema refusal is passed through as itself.
 */
export const whyItWouldNotDecode = (cause: unknown): string => {
  const issue = (cause as { readonly issue?: unknown } | null)?.issue
  if (!SchemaIssue.isIssue(issue)) return String(cause)

  return sayIssue(issue)
    .issues.map(({ path, message }) => `${(path ?? []).join(".")}: ${message}`)
    .join("\n")
}

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
  /**
   * The number a reply is addressed to, and the number an edit names.
   *
   * Their route takes this and not the thread's own id: a reply carrying a thread id is
   * refused with "The comment you are replying to has been deleted." See `replying.md`.
   */
  databaseId: Schema.optional(Schema.NullOr(Schema.Number)),
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
          databaseId: Schema.optional(Schema.NullOr(Schema.Number)),
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
  /** Whether this reader may say anything here at all, which a locked one refuses. */
  viewerCanReply: Schema.optional(Schema.Boolean),
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
  /**
   * `INJECTED_CONTEXT` is GitHub's fifth kind, and unchanged content: hunks made
   * only of these, both numbers equal, marked `~` rather than with a space. It
   * cost a real pull request its whole Control Center before it was known about,
   * which is why an unrecognised kind is worth more than a tighter enum here.
   */
  type: Schema.Literals(["HUNK", "CONTEXT", "ADDITION", "DELETION", "INJECTED_CONTEXT"]),
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
 * Somebody a commit is attributed to.
 *
 * All three are optional because all three go missing: a commit made under an
 * address that belongs to no account has no login, and a login GitHub cannot
 * resolve has no face. The same struct serves a commit's own page and the list
 * of a branch's, which describe the people on them identically.
 */
const CommitAuthor = Schema.Struct({
  login: Schema.optional(Schema.NullOr(Schema.String)),
  displayName: Schema.optional(Schema.NullOr(Schema.String)),
  avatarUrl: Schema.optional(Schema.NullOr(Schema.String))
})

/**
 * One commit, from the page GitHub serves for it.
 *
 * The diff entries are the same shape the pull request embeds, down to the line
 * records — one route's `status` where the other says `changeType`, and the
 * rest identical — so everything downstream of here is shared.
 */
export const CommitAnswer = Schema.Struct({
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
    authors: Schema.Array(CommitAuthor)
  }),
  asyncDiffLoadInfo: Schema.optional(Schema.NullOr(AsyncDiffLoad)),
  moreDiffsToLoad: Schema.optional(Schema.Boolean),
  diffEntryData: Schema.Array(CommitDiffEntry)
})

export type CommitAnswer = typeof CommitAnswer["Type"]

/**
 * A branch's commits, from the page GitHub serves for them.
 *
 * Grouped by day, and the grouping is theirs: the title of each group is a date
 * already written in the reader's own time zone, which is a thing the server
 * knows and this process does not.
 *
 * Their paging is a cursor rather than a page number — a sha and an offset with
 * a space between — so nothing here says how many pages there are. It says
 * whether there is another and where it starts, which is all a list that grows
 * while it is read can honestly say.
 */
export const CommitsAnswer = Schema.Struct({
  commitGroups: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      commits: Schema.Array(
        Schema.Struct({
          oid: Schema.String,
          authoredDate: Schema.String,
          // As on a commit's own page: a merge made through their web
          // interface carries the headline as rendered markdown and nothing
          // else, so the mapper takes whichever came.
          shortMessage: Schema.optional(Schema.NullOr(Schema.String)),
          shortMessageMarkdown: Schema.optional(Schema.NullOr(Schema.String)),
          bodyMessageHtml: Schema.optional(Schema.NullOr(Schema.String)),
          authors: Schema.Array(CommitAuthor),
          // Who put it on the branch, and whether GitHub thinks that is worth
          // saying. `committerAttribution` is their own answer to "are these
          // two the same person": false on the ordinary commit, true where a
          // rebase or a patch applied on somebody's behalf split them.
          committer: Schema.optional(Schema.NullOr(CommitAuthor)),
          committerAttribution: Schema.optional(Schema.Boolean)
        })
      )
    })
  ),
  // Which branch they resolved, which an address naming none still gets.
  refInfo: Schema.Struct({
    name: Schema.String
  }),
  // Where the rest of what they know about this page is. Their own list asks
  // for it as a second request the moment the rows are drawn.
  metadata: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        deferredDataUrl: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  ),
  filters: Schema.Struct({
    pagination: Schema.Struct({
      startCursor: Schema.optional(Schema.NullOr(Schema.String)),
      endCursor: Schema.optional(Schema.NullOr(Schema.String)),
      hasNextPage: Schema.Boolean,
      hasPreviousPage: Schema.Boolean
    })
  })
})

export type CommitsAnswer = typeof CommitsAnswer["Type"]

/**
 * The facts GitHub holds back from its own commit list.
 *
 * Answered by the address the list payload carries, for exactly the commits that
 * list drew — the route repeats the page's cursor, so the answer for page two is
 * not in the answer for page one.
 *
 * Every field but the sha is optional because every one of them goes missing: a
 * commit nothing has ever tested has no rollup, and an unsigned commit has no
 * signature to say anything about.
 */
export const DeferredCommitsRoute = Schema.Struct({
  deferredCommits: Schema.Array(
    Schema.Struct({
      oid: Schema.String,
      commentCount: Schema.optional(Schema.NullOr(Schema.Number)),
      statusCheckStatus: Schema.optional(
        Schema.NullOr(
          Schema.Struct({
            state: Schema.String,
            // Their own summary — "251 / 252 checks OK" — which is worth more
            // than the two numbers this would otherwise have to count again.
            short_text: Schema.optional(Schema.NullOr(Schema.String))
          })
        )
      ),
      verifiedStatus: Schema.optional(Schema.NullOr(Schema.String))
    })
  )
})

export type DeferredCommitsRoute = typeof DeferredCommitsRoute["Type"]

/**
 * Every branch a repository has, which is the whole list or nothing.
 *
 * `/owner/repo/refs?type=branch`, and it is names alone: no author, no date, no
 * ahead-and-behind. Their own picker reads exactly this and narrows it in the
 * browser — a `q` on the address is accepted and ignored, which was worth
 * finding out before writing a search that would have looked like it worked.
 *
 * Twenty-two kilobytes on a repository with a thousand branches, and one read
 * for all of them, which is what makes narrowing in the browser the right shape
 * rather than a shortcut.
 */
export const RefsRoute = Schema.Struct({
  refs: Schema.Array(Schema.String)
})

export type RefsRoute = typeof RefsRoute["Type"]

/**
 * Everybody who has written a commit on the repository, for the author filter.
 *
 * `/owner/repo/commits/deferred_commit_contributors`, which their own page asks
 * for after the list is drawn. Twelve kilobytes and no cursor: the route is the
 * same on every page of every branch, which is what makes it worth keeping.
 *
 * `name` is a real name where somebody set one and null where they did not, and
 * it is not read here: the filter is written against the login, and a row that
 * says "Sebastian Markbage" cannot be typed into a search for `sebmarkbage`.
 */
export const ContributorsRoute = Schema.Struct({
  authors: Schema.Array(
    Schema.Struct({
      login: Schema.String,
      primaryAvatarUrl: Schema.optional(Schema.NullOr(Schema.String))
    })
  )
})

export type ContributorsRoute = typeof ContributorsRoute["Type"]

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
 *
 * Null where nobody wrote one, which is not the same as the empty string GitHub
 * puts in `bodyHtml` beside it. Insisting on a string here failed the read of
 * every pull request in `microsoft/vscode`, a repository where most changes are one
 * line and the description is left blank.
 */
export const DescriptionRoute = Schema.Struct({
  body: Schema.NullOr(Schema.String),
  bodyHtml: Schema.String
})

export type DescriptionRoute = typeof DescriptionRoute["Type"]

/**
 * A repository's front page, from the document their own code view renders.
 *
 * One document carries the whole page: the root of the tree, the README already
 * rendered to HTML, how many commits the branch has, what the About panel says, and
 * whether the reader can push. The README is the bulk of it — three hundred kilobytes
 * of the three hundred and thirty for a well-documented repository — and it arriving
 * here is why this page costs one request rather than the six GitHub's own spends.
 *
 * Three shapes rather than one, because those facts are three of GitHub's own route
 * payloads sitting side by side in that document, and each is searched for on its own.
 * A repository whose About panel changes shape still draws its files, and no reader here
 * knows what any of the three payloads is called this week.
 *
 * Everything below the tree is optional because every part of it goes missing on
 * a real repository. A repository with no README has no overview file, one with
 * an empty default branch has no `refInfo` worth reading, and a repository nobody
 * has starred still has to draw.
 */
export const RepoTree = Schema.Struct({
  refInfo: Schema.Struct({
    name: Schema.String,
    currentOid: Schema.String,
    refType: Schema.optional(Schema.String)
  }),
  tree: Schema.Struct({
    items: Schema.Array(
      Schema.Struct({
        name: Schema.String,
        path: Schema.String,
        // `directory`, `file`, or `submodule`. Kept as it came rather than
        // narrowed to a union: a fourth kind is a row drawn plainly, not a
        // payload this refuses to read.
        contentType: Schema.String
      })
    ),
    totalCount: Schema.Number
  }),
  overview: Schema.optional(
    Schema.Struct({
      /*
       * A string on a live payload — `"140"`, measured — and typed as either
       * because a count that starts arriving as a number should not cost the
       * whole page. Made a number by the mapper rather than here, so the one
       * place that knows this is odd is the one place that reads it.
       */
      commitCount: Schema.optional(Schema.NullOr(Schema.Union([Schema.Number, Schema.String]))),
      overviewFiles: Schema.optional(
        Schema.Array(
          Schema.Struct({
            displayName: Schema.String,
            path: Schema.String,
            richText: Schema.optional(Schema.NullOr(Schema.String)),
            // True when GitHub gave up rendering it, which happens on the
            // largest READMEs. The screen says so rather than showing a blank.
            timedOut: Schema.optional(Schema.NullOr(Schema.Boolean))
          })
        )
      )
    })
  )
})

export type RepoTree = typeof RepoTree["Type"]

/**
 * Where the reader stands with this repository, from the one field that says so.
 *
 * Absent from every JSON answer, and present in the document.
 *
 * Measured rather than assumed: `/owner/repo` asked with `Accept: application/json`
 * returns the code view's own answer alone and never the layout around it, from inside
 * the repository and from outside it alike. Their own app has the layout already and
 * never asks for it twice, so the one place this field exists is the embedded payload of
 * a loaded document — which is where the front page reads it, and why the screen prefers
 * the document it is standing on.
 *
 * Anchored on `repo.currentUserCanPush` being there, which is the field being read. It
 * has to be required: their About payload carries a `repo` object of its own, so a shape
 * asking only for a `repo` matches in two places and a search across the document then
 * refuses. Where GitHub stops sending it the footing is Caller, which is the safe way
 * round: a Keeper shown the welcome first has to scroll past a README they wrote.
 */
export const RepoFooting = Schema.Struct({
  repo: Schema.Struct({
    currentUserCanPush: Schema.NullOr(Schema.Boolean),
    isFork: Schema.optional(Schema.NullOr(Schema.Boolean))
  })
})

export type RepoFooting = typeof RepoFooting["Type"]

/**
 * What the About panel says.
 *
 * Everything drawn from here is optional, because every part of it goes missing on a
 * real repository: one with no description, one nobody has starred, one with no topics.
 * That leaves nothing required to find it by, and a shape that matches an empty object
 * would match the first object in the document.
 *
 * So the anchor is `stargazersPath`, which is not drawn at all. Their About payload
 * always carries it, it appears once in the document, and anchoring on it rather than on
 * a count means a repository that stops sending counts still draws its description.
 */
export const RepoAbout = Schema.Struct({
  stargazersPath: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  stargazerCount: Schema.optional(Schema.NullOr(Schema.Number)),
  forksCount: Schema.optional(Schema.NullOr(Schema.Number)),
  /*
   * A flat array of names, and an empty one where a repository has no
   * topics. Read off a live payload for `facebook/react`, which carries six
   * of them and nothing else on each: no URL, no id.
   */
  topics: Schema.optional(Schema.NullOr(Schema.Array(Schema.Struct({ name: Schema.String })))),
  /*
   * Whether the reader has starred this and whether they may. Both are
   * needed and neither can be worked out from the other: a signed-out
   * reader has not starred it and cannot, and their own button is drawn
   * from exactly these two.
   */
  star: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        viewerHasStarred: Schema.optional(Schema.NullOr(Schema.Boolean)),
        canStar: Schema.optional(Schema.NullOr(Schema.Boolean))
      })
    )
  )
})

export type RepoAbout = typeof RepoAbout["Type"]

/**
 * What `/owner/repo/_sidebar` answers with.
 *
 * Nine sections, every one of them nullable, because GitHub sends the key with
 * `null` behind it rather than leaving it out. Recorded from `react/react`,
 * which has six of the nine, and from a private repository of ours, which has
 * three — the difference is what every optional below is for.
 */
const Faced = Schema.Struct({
  login: Schema.String,
  profileName: Schema.optional(Schema.NullOr(Schema.String)),
  profilePath: Schema.String,
  avatarUrl: Schema.String
})

export const SidebarRoute = Schema.Struct({
  releases: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        latestRelease: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              name: Schema.String,
              path: Schema.String,
              publishedAt: Schema.String
            })
          )
        ),
        releasesPath: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  ),
  deployments: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        environments: Schema.optional(
          Schema.NullOr(
            Schema.Array(
              Schema.Struct({
                name: Schema.String,
                state: Schema.optional(Schema.NullOr(Schema.String)),
                path: Schema.String
              })
            )
          )
        ),
        deploymentsPath: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  ),
  usedBy: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        dependentCount: Schema.optional(Schema.NullOr(Schema.Number)),
        dependents: Schema.optional(
          Schema.NullOr(Schema.Array(Schema.Struct({ avatarUrl: Schema.String })))
        ),
        dependentsPath: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  ),
  contributors: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        contributorCount: Schema.optional(Schema.NullOr(Schema.Number)),
        contributors: Schema.optional(Schema.NullOr(Schema.Array(Faced))),
        contributorsPath: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  ),
  languages: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        languages: Schema.optional(
          Schema.NullOr(
            Schema.Array(
              Schema.Struct({
                name: Schema.String,
                percentage: Schema.Number,
                color: Schema.optional(Schema.NullOr(Schema.String)),
                searchAlias: Schema.optional(Schema.NullOr(Schema.String))
              })
            )
          )
        ),
        ownerLogin: Schema.optional(Schema.NullOr(Schema.String)),
        repoName: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  ),
  packages: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        packageCount: Schema.optional(Schema.NullOr(Schema.Number)),
        packagesPath: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  )
})

export type SidebarRoute = typeof SidebarRoute["Type"]

/**
 * Every path in a repository at one commit, off `/owner/repo/tree-list/<sha>`.
 *
 * Flat, slash-separated and files only: the directories are the prefixes, and
 * the tree is built from them rather than sent. Asked by commit and not by
 * branch — the branch form answers 400.
 */
export const TreeListRoute = Schema.Struct({
  paths: Schema.Array(Schema.String)
})

export type TreeListRoute = typeof TreeListRoute["Type"]

/**
 * One file, out of the page GitHub renders for it.
 *
 * Read from the document rather than from the JSON that route also answers: the
 * JSON carries the blob route alone, and the lines of the file are in the layout
 * route around it. One document holds both, along with their rendering of a
 * markdown file, and it is the only answer that holds all three.
 *
 * Two shapes, searched for separately, because the lines and the rendering are two
 * payloads of theirs in that document. One of the keys they sat under really did have a
 * dot in its name, `codeViewBlobLayoutRoute.StyledBlob`, as one key rather than two
 * levels — the kind of detail that costs a screen when a reader has to spell it.
 */
export const FileLines = Schema.Struct({
  rawLines: Schema.NullOr(Schema.Array(Schema.String))
})

export type FileLines = typeof FileLines["Type"]

/**
 * The same file as GitHub rendered it, where they render it at all.
 *
 * Its own shape and its own search, because it is a second payload of theirs in the same
 * document as the lines. A file they do not render has none of this and still has to
 * draw, so the pane treats it as absent rather than as a page that would not read.
 */
export const FileRendering = Schema.Struct({
  richText: Schema.NullOr(Schema.String)
})

export type FileRendering = typeof FileRendering["Type"]

/**
 * What each row of the file list was last touched by.
 *
 * A route of its own, and the one extra request this page spends. Their own page
 * spends it too, which is why it is affordable: 234 milliseconds and eight
 * kilobytes for a repository of thirteen entries, measured.
 *
 * Both halves of the answer are drawn. The date is the part their readers defend
 * — "I find the commit messages confusing, but find the last changed dates more
 * useful" — and the message is the part they attack, because one whitespace commit
 * overwrites the message of a large refactor. It is shown anyway, and next to the
 * date, so that the reader can see when a message is not worth believing.
 */
export const TreeCommitInfoRoute = Schema.Struct({
  entries: Schema.Record(
    Schema.String,
    Schema.Struct({
      oid: Schema.String,
      url: Schema.String,
      date: Schema.String,
      /*
       * An anchor element as a string, not a message. GitHub renders the headline
       * with its issue and commit references already linked, and there is no plain
       * copy of it anywhere in the payload — so the text is taken back out of it.
       */
      shortMessageHtmlLink: Schema.optional(
        Schema.NullOr(
          Schema.Union([Schema.String, Schema.Struct({ value: Schema.String })])
        )
      ),
      /*
       * The person, where this route already named them.
       *
       * Absent on the payloads we have recorded. Optional so a later shape that
       * carries a login can skip the extra read of unique SHAs.
       */
      author: Schema.optional(
        Schema.NullOr(
          Schema.Union([
            Schema.String,
            Schema.Struct({
              login: Schema.optional(Schema.NullOr(Schema.String)),
              avatarUrl: Schema.optional(Schema.NullOr(Schema.String))
            })
          ])
        )
      )
    })
  )
})

export type TreeCommitInfoRoute = typeof TreeCommitInfoRoute["Type"]

/**
 * One commit, off `/owner/repo/latest-commit/<sha>`, for the face beside a row.
 *
 * The cheap answer to "who wrote this". The column route above names nobody, and
 * the commit's own page — which is what this replaced — carries the whole diff to
 * say it: measured at 2 kilobytes here against 28 on this repository and 390 on
 * `facebook/react`. The fields are the column's four, plus the person.
 *
 * `author` is the git author with a login and a pre-sized avatar where the email
 * belongs to an account, and a display name with neither where it does not.
 * `authors` is the same person first, then anybody the trailers credit.
 *
 * The route means "the latest commit at this ref, under this path", so a path on
 * the end answers about a different commit. The `oid` it returns is checked
 * against the one that was asked for.
 */
export const LatestCommitRoute = Schema.Struct({
  oid: Schema.optional(Schema.NullOr(Schema.String)),
  author: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        login: Schema.optional(Schema.NullOr(Schema.String)),
        displayName: Schema.optional(Schema.NullOr(Schema.String)),
        avatarUrl: Schema.optional(Schema.NullOr(Schema.String))
      })
    )
  ),
  authors: Schema.optional(
    Schema.NullOr(
      Schema.Array(
        Schema.Struct({
          login: Schema.optional(Schema.NullOr(Schema.String)),
          displayName: Schema.optional(Schema.NullOr(Schema.String)),
          avatarUrl: Schema.optional(Schema.NullOr(Schema.String))
        })
      )
    )
  )
})

export type LatestCommitRoute = typeof LatestCommitRoute["Type"]

/**
 * The three moments of a pull request, from the route GitHub's own header reads.
 *
 * Five kilobytes for what the other four routes do not carry: when it was
 * opened, when it closed, and when it landed. The rest of what it answers —
 * title, state, author, branches — is already read from `/changes`, and reading
 * it twice would mean two versions of the same fact.
 *
 * Every moment is optional as well as nullable. They are a nicety rather than
 * facts the card is built on: a payload that stopped carrying one should cost
 * the age beside the badge, not the whole pull request. Null is what arrives
 * for an end a pull request has not reached.
 */
export const HeaderRoute = Schema.Struct({
  pullRequest: Schema.Struct({
    createdTime: Schema.optional(Schema.NullOr(Schema.String)),
    closedTime: Schema.optional(Schema.NullOr(Schema.String)),
    mergedTime: Schema.optional(Schema.NullOr(Schema.String))
  })
})

export type HeaderRoute = typeof HeaderRoute["Type"]

/**
 * The states GitHub's own pull request pages send.
 *
 * Five, not the three their GraphQL `PullRequestState` has: these routes spell a
 * draft `DRAFT` and one standing in the merge queue `QUEUED`, both of which are
 * open pull requests as far as GraphQL is concerned — the merge box for a queued
 * pull request answers `OPEN` in the same second the changes route answers
 * `QUEUED`. Shared between the routes because a value one of them starts sending
 * is a value the others are about to.
 */
const PullRequestStateOnTheWire = Schema.Literals([
  "OPEN",
  "CLOSED",
  "MERGED",
  "DRAFT",
  "QUEUED"
])

export const ChangesRoute = Schema.Struct({
  pullRequest: Schema.Struct({
    number: Schema.Number,
    title: Schema.String,
    state: PullRequestStateOnTheWire,
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

export type ChangesRoute = typeof ChangesRoute["Type"]

/**
 * How many lines a pull request changes, and nothing else at all.
 *
 * Seventy bytes on the wire, which is why a list can afford one of these per row
 * where it cannot afford {@link ChangesRoute} — the same two counts arrive there,
 * under three quarters of a megabyte of the diffs they describe. `linesChanged`
 * is their sum and is left undecoded: adding two numbers is not a read.
 */
export const DiffstatRoute = Schema.Struct({
  diffstat: Schema.Struct({
    linesAdded: Schema.Number,
    linesDeleted: Schema.Number
  })
})

export type DiffstatRoute = typeof DiffstatRoute["Type"]

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
 * What was said on the timeline rather than against a line.
 *
 * A bare array, not an object with the array inside it, and the only route that
 * carries these bodies: the `timeline` route beside it lists the same items by
 * id and type and sends no text at all. The author arrives as a login and an
 * avatar with nothing to say whether it is a person — unlike a thread author,
 * who has `isAgent` — so the `[bot]` suffix GitHub puts on an app's login is
 * the only thing there is to read it from.
 */
export const IssueCommentsRoute = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    authorLogin: Schema.String,
    authorAvatarUrl: Schema.optional(Schema.NullOr(Schema.String)),
    body: Schema.String,
    bodyHtml: Schema.String,
    createdAt: Schema.String,
    isHidden: Schema.Boolean,
    minimizedReason: Schema.optional(Schema.NullOr(Schema.String))
  })
)

export type IssueCommentsRoute = typeof IssueCommentsRoute["Type"]

/**
 * What their `createIssueMutation` answers with, less everything it answers with.
 *
 * The number and nothing else. Their answer also carries the title back, the
 * node ids of the issue and of its repository, the repository's own numeric id,
 * and its owner — and the reader typed the title, the screen knows the
 * repository, and no part of this codebase addresses an issue by a node id. What
 * is left is the one fact nobody could have known before the write, which is
 * which number GitHub gave it.
 *
 * `errors` beside the issue rather than at the top of the answer, which is where
 * a GraphQL failure normally is. Their mutation carries both: a refusal arrives
 * as an empty issue and a filled `errors`, and 200 either way. Recorded against
 * `flazouh/stack-probe` on 5 August 2026, where a success came back with
 * `"errors":[]` next to a real issue.
 */
export const CreatedIssueRoute = Schema.Struct({
  data: Schema.Struct({
    createIssue: Schema.Struct({
      issue: Schema.Struct({ number: Schema.Number })
    })
  })
})

export type CreatedIssueRoute = typeof CreatedIssueRoute["Type"]

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

/**
 * One pull request of a stack, as the condition about the stack lists it.
 *
 * `state` is left a plain string rather than the enum the changes route gets.
 * These are other people's pull requests described in passing, and a word
 * arriving here that nothing has seen before must not fail the merge box of the
 * pull request actually being read.
 */
const StackEntry = Schema.Struct({
  pull: Schema.Struct({
    number: Schema.Number,
    title: Schema.String,
    state: Schema.String,
    headBranch: Schema.String,
    /** A path rather than an address: `/owner/repo/pull/8`. */
    url: Schema.optional(Schema.NullOr(Schema.String))
  }),
  /** `BEFORE`, `CURRENT` or `AFTER`, against the pull request being read. */
  position: Schema.String
})

export const MergeBoxRoute = Schema.Struct({
  pullRequest: Schema.Struct({
    /**
     * The two branch names, which a stack is found by matching.
     *
     * Optional because this is the cheap place to read them, not the only one:
     * the changes route calls the same two things `baseBranch` and `headBranch`
     * and costs up to a megabyte to say so, where this whole payload is five
     * kilobytes. A payload without them is one row that will not be stacked,
     * which is not worth failing a merge card over.
     */
    baseRefName: Schema.optional(Schema.NullOr(Schema.String)),
    headRefName: Schema.optional(Schema.NullOr(Schema.String)),
    /**
     * The branch the whole stack lands on, which is one branch for all of it.
     *
     * The one fact about a stack that the condition listing it does not carry.
     * Its entries give a head branch each and no base, so the foundation's base
     * is nowhere in that list: read from the top of a chain of three this says
     * `main` while `baseRefName` says `feat-b`, the layer directly underneath.
     * GitHub's own schema has the same thing as `PullRequestStack.baseRefName`,
     * "the branch that the stack's pull requests target".
     *
     * It falls back to `baseRefName` on a pull request GitHub keeps no stack
     * for — including a chain of branches based on each other that it has not
     * made one of, measured on `flazouh/stack-probe#14`, where both said
     * `probe-t1` rather than the repository's `main`. So it answers about a
     * stack only where a stack condition arrived beside it.
     */
    stackedBaseRefName: Schema.optional(Schema.NullOr(Schema.String)),
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
    viewerCanAdminBypassMergeRequirements: Schema.optional(Schema.NullOr(Schema.Boolean)),
    /**
     * Whether the branch this was made from is still there to be deleted, and
     * whether it has already gone.
     *
     * The two of them swap over the moment the branch does, which is what makes
     * this worth reading rather than working out from the state: a repository
     * that deletes head branches on merge by itself says no to both before
     * anybody has pressed anything, and so does a fork nobody here can write to.
     * Measured on `flazouh/ghpro-scratch#11`, before and after the delete.
     */
    viewerCanDeleteHeadRef: Schema.optional(Schema.NullOr(Schema.Boolean)),
    viewerCanRestoreHeadRef: Schema.optional(Schema.NullOr(Schema.Boolean))
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
          ruleRollups: Schema.optional(Schema.NullOr(Schema.Array(RuleRollup))),
          /**
           * The paths that conflict, on the one condition that is about a
           * conflict.
           *
           * A flat array in GitHub's own order, with no count and no line
           * numbers, and the reason this needs no route of its own: their page
           * lists the conflicting files from the same payload the card here is
           * already drawn from. Null on a pull request with no conflict, where
           * the key arrives all the same.
           *
           * See `docs/spec/conflicted-files.md`.
           */
          conflicts: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
          /**
           * Whether GitHub says their web editor could resolve them.
           *
           * Read on its own terms rather than beside `webEditorConflictResolution`,
           * which arrives next to it and agreed with it on the one conflicted pull
           * request measured. One observation cannot say which of the two refuses
           * first, and the spec says where to look if a difference turns up.
           */
          isConflictResolvableInWeb: Schema.optional(Schema.NullOr(Schema.Boolean)),
          /**
           * The whole stack, on the one condition that is about being in one.
           *
           * A strange place for it and the only place it is sent. GitHub files
           * a stack as a merge requirement — `type: "STACK"` — so the list of
           * pull requests that land together arrives beside the reasons this
           * one might not, in a payload the gateway already fetches. Nothing
           * else has to be asked for.
           */
          stack: Schema.optional(Schema.NullOr(Schema.Struct({ number: Schema.Number }))),
          entries: Schema.optional(Schema.NullOr(Schema.Array(StackEntry)))
        })
      )
    })
  )
})

export type MergeBoxRoute = typeof MergeBoxRoute["Type"]

/**
 * The stack GitHub offers to make, on the route that exists to be asked.
 *
 * `page_data/preview_stack`, which is what their own "Preview stack" button
 * fetches before it opens its dialog. A few hundred bytes, and the only place the
 * state is knowable from: measured on `flazouh/stack-probe`, the merge box's
 * `STACK` condition reads `stack: null` with no entries on a pull request that can
 * be stacked and on one with nothing to stack alike, so nothing the gateway
 * already fetches tells them apart.
 *
 * Null rather than empty where there is nothing to offer, which is a 200 and not a
 * refusal: GitHub answers it on a pull request already in a stack, and on one whose
 * branch nothing stands on.
 *
 * Newest first, as the merge box sends a stack's entries. `baseBranch` per entry is
 * what those entries never carry, so the branch the whole chain would land on is
 * the foundation's base rather than a field of its own.
 *
 * `stackId` and `stackNumber` arrive null on every entry and are left out. They are
 * the fields a stack GitHub holds would have filled, which is the same thing the
 * body being an array at all has already said.
 */
export const PreviewStackRoute = Schema.NullOr(
  Schema.Array(
    Schema.Struct({
      /**
       * GitHub's own numeric id, which is the only name the route that makes the
       * stack will accept: it takes `pullRequestIds` and knows nothing of the
       * numbers a reader calls these pull requests by. Read here because this is
       * the one payload that carries both.
       */
      id: Schema.Number,
      number: Schema.Number,
      title: Schema.String,
      /** A plain string, for the reason `StackEntry.state` is one. */
      state: Schema.String,
      headBranch: Schema.String,
      baseBranch: Schema.String
    })
  )
)

export type PreviewStackRoute = typeof PreviewStackRoute["Type"]

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

/**
 * A page of rows, which is what both of their pull request lists answer with.
 *
 * One shape for two routes: `/pulls/inbox/queries?filter=…` serves a shelf and
 * `/pulls?q=…` serves an arbitrary search, and the rows are the same rows. Only the
 * shelf route fills in `category`, so what a payload holds is said by which route was
 * asked rather than by anything in the answer, and both callers know which they asked.
 */
export const Listing = Schema.Struct({
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

export type Listing = typeof Listing["Type"]

/**
 * What the rows arrive without: how the checks stand, and how the reviews did.
 *
 * GitHub's own dashboard fetches this straight after the rows, batched nine ids
 * at a time, because neither fact is on a row. Which makes an attention-aware
 * Working Set two requests rather than one per pull request.
 */
export const DeferredRoute = Schema.Struct({
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

export type DeferredRoute = typeof DeferredRoute["Type"]

/**
 * Their repository filter's answer.
 *
 * The route behind the picker in their own dashboard sidebar, and the only place this
 * extension can read a Participant's whole list from: 154 repositories in one 44-kilobyte
 * answer on a live account, each with the owner's face beside it. Their `q` parameter is
 * left alone — the whole list arrives in a single read, so narrowing it is typing rather
 * than another request.
 *
 * Asked for with different headers from everything else here. It answers 406 to the
 * XMLHttpRequest header the other routes require, and 200 to `Content-Type: application/json`
 * on a GET, which is what their own bundle sends.
 */
export const FilteredRepositories = Schema.Struct({
  repositories: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      owner: Schema.String,
      nameWithOwner: Schema.String,
      ownerAvatar: Schema.optional(Schema.NullOr(Schema.String)),
      ownerType: Schema.optional(Schema.NullOr(Schema.String)),
      visibility: Schema.optional(Schema.NullOr(Schema.String)),
      isEmpty: Schema.optional(Schema.NullOr(Schema.Boolean))
    })
  )
})

export type FilteredRepositories = typeof FilteredRepositories["Type"]

/**
 * Their issue search's answer.
 *
 * The route behind GitHub's own search results page, and the only route left that
 * answers about a Participant's issues in a shape anything can read. Their issues
 * dashboard was rebuilt this year: `/issues?q=…` asked for JSON now answers with a
 * shell holding no rows at all, and the rows that do appear are fetched by a
 * persisted GraphQL query whose name is a hash that changes with every deploy.
 * This one is asked for exactly as a shelf is, and was measured against a live
 * account: 304 issues over 31 pages, ten to a page.
 *
 * What it does not carry is worth naming, because two rules were shaped by it. No
 * assignees, so nothing here can tell an issue nobody picked up from one somebody
 * else did, and `courtOfIssue` does not pretend to. No time of last change, so the
 * order is GitHub's own rather than a sort invented over a field that is not there.
 *
 * `hl_title` is the title with the search's own matches marked up, and it is a
 * plain title here for a reason that holds as long as the queries do: the three
 * this extension sends are qualifiers with no free text in them, so there is
 * nothing for GitHub to mark.
 */
export const IssueSearchAnswer = Schema.Struct({
  results: Schema.Array(
      Schema.Struct({
        /** Their own id, as a string on this route where every other one sends a number. */
        id: Schema.String,
        number: Schema.Number,
        /**
         * Two states and no more. An issue does not merge and is never a draft,
         * and their `state_reason` beside this says whether a closed one was
         * completed or discarded, which is a distinction for the issue's own page
         * rather than for a list where both mean nobody owes it a move.
         */
        state: Schema.Literals(["open", "closed"]),
        hl_title: Schema.String,
        /** Absent for an issue whose author's account is gone. */
        author_name: Schema.optional(Schema.NullOr(Schema.String)),
        author_avatar_url: Schema.optional(Schema.NullOr(Schema.String)),
        num_comments: Schema.Number,
        /**
         * Counted, not read. They arrived as plain strings on every row observed,
         * and a payload that starts sending objects instead should cost a label
         * count rather than the whole list.
         */
        labels: Schema.Array(Schema.Unknown),
        created: Schema.String,
        repo: Schema.Struct({
          repository: Schema.Struct({
            name: Schema.String,
            owner_login: Schema.String
          })
        }),
        /**
         * Null on an issue and a number on a pull request, which is how a row that
         * is not an issue is recognised. The queries all say `is:issue`, so this is
         * a second lock on the one door: a search route that started answering more
         * widely would otherwise put pull requests in the Courts twice over.
         */
        issue: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              issue: Schema.Struct({
                pull_request_id: Schema.optional(Schema.NullOr(Schema.Number))
              })
            })
          )
        )
      })
    ),
  /** Where this page sits, in the same three numbers a pull request search gives. */
  page: Schema.Number,
  page_count: Schema.Number,
  result_count: Schema.Number
})

export type IssueSearchAnswer = typeof IssueSearchAnswer["Type"]


/**
 * The events GitHub still serves in the order they happened.
 *
 * Their own feed route answers with four kinds of card — a follow, a merged pull request, a
 * trending repository and a recommendation — and no pushes at all, which is
 * [#173638](https://github.com/orgs/community/discussions/173638) confirmed at first hand.
 * The same account's events in the same minute were two thirds pushes, so this is where
 * Activity comes from.
 *
 * Loosely typed on purpose. There are two dozen event types, this draws seven of them, and
 * an unfamiliar `type` is a line to leave out rather than a read to fail: a schema that
 * insisted on the whole vocabulary would break the feed the first time GitHub added an
 * event nobody here had heard of.
 */
export const PublicEvents = Schema.Array(
  Schema.Struct({
    type: Schema.String,
    created_at: Schema.String,
    actor: Schema.Struct({
      login: Schema.String,
      avatar_url: Schema.optional(Schema.NullOr(Schema.String))
    }),
    repo: Schema.Struct({ name: Schema.String }),
    payload: Schema.Struct({
      /** A push's branch, as `refs/heads/name`, or a branch that was made or deleted. */
      ref: Schema.optional(Schema.NullOr(Schema.String)),
      ref_type: Schema.optional(Schema.NullOr(Schema.String)),
      /** How many commits a push carried. Their public events carry no subjects. */
      size: Schema.optional(Schema.NullOr(Schema.Number)),
      action: Schema.optional(Schema.NullOr(Schema.String)),
      /**
       * Trimmed to almost nothing, and worth knowing before designing a row around it:
       * their public events carry a pull request's number, its two branches and two
       * addresses for machines, and no title. So an Activity line about a pull request
       * says "#4 in owner/repo" and links to it; the title is not available at any price
       * this extension can pay, and inventing one would be worse than leaving it out.
       *
       * Whether it was merged is in the event's `action`, which is one of `opened`,
       * `closed`, `reopened` and `merged` — not in a flag on the pull request, as their
       * webhook payloads have it.
       */
      pull_request: Schema.optional(
        Schema.NullOr(
          Schema.Struct({
            number: Schema.Number,
            head: Schema.optional(
              Schema.NullOr(Schema.Struct({ ref: Schema.optional(Schema.NullOr(Schema.String)) }))
            )
          })
        )
      ),
      issue: Schema.optional(
        Schema.NullOr(
          Schema.Struct({
            number: Schema.Number,
            title: Schema.String,
            html_url: Schema.String
          })
        )
      ),
      comment: Schema.optional(
        Schema.NullOr(Schema.Struct({ html_url: Schema.String }))
      ),
      /**
       * The review a `PullRequestReviewEvent` is about.
       *
       * Its address is the review itself, anchored on the pull request page, which is
       * where a reader following the line wants to land. Optional like everything else
       * here: an event of this type with no review in it is served for a review that was
       * dismissed, and the pull request is still worth pointing at.
       */
      review: Schema.optional(
        Schema.NullOr(
          Schema.Struct({
            html_url: Schema.optional(Schema.NullOr(Schema.String)),
            /** `approved`, `changes_requested` or `commented`. Not drawn yet. */
            state: Schema.optional(Schema.NullOr(Schema.String))
          })
        )
      )
    })
  })
)

export type PublicEvents = typeof PublicEvents["Type"]

/**
 * Whoever wrote something, as their GraphQL routes send a person.
 *
 * Null where the account is gone, which GitHub renders as `ghost` and so does
 * everything here that meets one.
 */
const Speaker = Schema.NullOr(
  Schema.Struct({
    login: Schema.String,
    avatarUrl: Schema.optional(Schema.NullOr(Schema.String)),
    /** `User`, `Bot`, `Organization`, `Mannequin`. Only the second is drawn differently. */
    __typename: Schema.optional(Schema.NullOr(Schema.String))
  })
)

/**
 * One issue, as the query their own issue page runs.
 *
 * The whole page in one request, which is the reason this route was chosen over
 * every other way of reading an issue. Measured at 38 kilobytes for a
 * twelve-item timeline: the title, the body in both forms, the state and why it
 * closed, labels with their colours, assignees, reactions, the timeline itself
 * and — the part nothing else answers — what the reader is allowed to do.
 *
 * Asked for by name and by a hash of the query text that changes with every
 * deploy. `persisted.ts` is where that hash comes from and why.
 *
 * Loose in three places on purpose. Timeline nodes are read by `__typename` and
 * an unfamiliar one is a line to leave out rather than a read to fail — GitHub
 * has two dozen of them and adds to the list. The `viewerCan…` fields arrive
 * null rather than false for a signed-out reader, which means the same thing
 * here. And everything this codebase does not draw is simply absent from the
 * schema, so a field GitHub removes costs nothing unless something wanted it.
 */
export const IssueViewRoute = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({
      issue: Schema.Struct({
        /**
         * GitHub's own name for this issue, which every write to it is addressed to.
         *
         * Their route sends it and nothing else will do: the mutation behind closing an
         * issue takes this and not an owner, a repository and a number. See `settleIssue`.
         */
        id: Schema.String,
        number: Schema.Number,
        title: Schema.String,
        body: Schema.String,
        /** Their own rendering of the body, so ours reads as theirs does. */
        bodyHTML: Schema.String,
        /** Upper case on this route, where their search route sends lower. */
        state: Schema.Literals(["OPEN", "CLOSED"]),
        /**
         * Why a closed one closed. Null on an open issue, and null on a closed
         * one from before GitHub recorded the reason.
         */
        stateReason: Schema.optional(Schema.NullOr(Schema.String)),
        createdAt: Schema.String,
        author: Schema.optional(Speaker),
        labels: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              edges: Schema.Array(
                Schema.Struct({
                  node: Schema.NullOr(
                    Schema.Struct({
                      name: Schema.String,
                      /** Six hex digits with no leading hash, which is theirs to decide. */
                      color: Schema.String,
                      description: Schema.optional(Schema.NullOr(Schema.String))
                    })
                  )
                })
              )
            })
          )
        ),
        /**
         * Who was given it. Named for actors rather than users because GitHub
         * now assigns agents as well as people, and both arrive here.
         */
        assignedActors: Schema.optional(
          Schema.NullOr(Schema.Struct({ nodes: Schema.Array(Speaker) }))
        ),
        /**
         * All eight, every time, most of them zero. Trimmed after decoding
         * rather than here: what arrives is theirs, what is drawn is ours.
         */
        reactionGroups: Schema.optional(
          Schema.NullOr(
            Schema.Array(
              Schema.Struct({
                content: Schema.String,
                viewerHasReacted: Schema.Boolean,
                reactors: Schema.optional(
                  Schema.NullOr(Schema.Struct({ totalCount: Schema.Number }))
                )
              })
            )
          )
        ),
        viewerCanComment: Schema.optional(Schema.NullOr(Schema.Boolean)),
        /**
         * The two their query really sends, out of which who may close one is read.
         *
         * `viewerCanClose` below is not sent and never has been. See `maySettle`.
         */
        viewerCanUpdateMetadata: Schema.optional(Schema.NullOr(Schema.Boolean)),
        viewerDidAuthor: Schema.optional(Schema.NullOr(Schema.Boolean)),
        viewerCanClose: Schema.optional(Schema.NullOr(Schema.Boolean)),
        viewerCanReopen: Schema.optional(Schema.NullOr(Schema.Boolean)),
        viewerCanLabel: Schema.optional(Schema.NullOr(Schema.Boolean)),
        viewerCanAssign: Schema.optional(Schema.NullOr(Schema.Boolean)),
        /**
         * The conversation and everything that happened around it, oldest
         * first. Their word for it, kept: there is a `backTimelineItems`
         * beside it holding the newest page of a long one.
         */
        frontTimelineItems: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              edges: Schema.Array(
                Schema.Struct({
                  node: Schema.NullOr(
                    Schema.Struct({
                      __typename: Schema.String,
                      id: Schema.optional(Schema.NullOr(Schema.String)),
                      author: Schema.optional(Speaker),
                      body: Schema.optional(Schema.NullOr(Schema.String)),
                      bodyHTML: Schema.optional(Schema.NullOr(Schema.String)),
                      createdAt: Schema.optional(Schema.NullOr(Schema.String)),
                      /** Set on a comment GitHub folded away as spam or off topic. */
                      isHidden: Schema.optional(Schema.NullOr(Schema.Boolean))
                    })
                  )
                })
              )
            })
          )
        )
      })
    }),
    /**
     * Who is reading, which their own page needs for the same reason this does:
     * to sign the box that writes a comment. Null when nobody is signed in.
     */
    safeViewer: Schema.optional(Speaker)
  })
})

export type IssueViewRoute = typeof IssueViewRoute["Type"]

/**
 * What their `addCommentMutation` hands back, which is the comment itself.
 *
 * Recorded on 2026-08-06 by pressing their own comment box with a recorder over `fetch`. The
 * node they return carries forty fields; these five are the ones a Remark is made of, and the
 * point of taking them is that nothing has to be read again: the comment appears in the
 * conversation with GitHub's own rendering of it, markdown, mentions and all.
 */
export const AddedComment = Schema.Struct({
  data: Schema.Struct({
    addComment: Schema.Struct({
      timelineEdge: Schema.Struct({
        node: Schema.Struct({
          id: Schema.String,
          author: Schema.optional(Speaker),
          body: Schema.optional(Schema.NullOr(Schema.String)),
          bodyHTML: Schema.String,
          createdAt: Schema.optional(Schema.NullOr(Schema.String))
        })
      })
    })
  })
})

export type AddedComment = typeof AddedComment["Type"]

/**
 * Who can be mentioned in this repository, as their own suggester answers.
 *
 * `GET /suggestions/issue?mention_suggester=1&repository=R&user_id=O` with a JSON accept,
 * recorded on 2026-08-06. The whole list arrives in one answer with no query in it, which is
 * why the box filters where it stands rather than asking on every keystroke.
 */
export const Mentionable = Schema.Array(
  Schema.Struct({
    type: Schema.optional(Schema.String),
    login: Schema.String,
    name: Schema.optional(Schema.NullOr(Schema.String))
  })
)

export type Mentionable = typeof Mentionable["Type"]

/** What can be referred to by number here, from the same route with `issue_suggester=1`. */
export const Referable = Schema.Struct({
  suggestions: Schema.Array(
    Schema.Struct({
      number: Schema.Number,
      title: Schema.String,
      /**
       * Their word for what it is: `issue_open`, `issue_closed`, `pull_request`, and `skip`
       * for the one the reader is looking at. Kept as written, because the mapping to open
       * or closed belongs where the domain is.
       */
      type: Schema.optional(Schema.String)
    })
  )
})

export type Referable = typeof Referable["Type"]

/**
 * What `/upload/policies/assets` answers, which is the whole of a file upload except the bytes.
 *
 * Three requests make one upload and this answer holds the address and the paperwork for the
 * other two: `form` goes to their storage beside the file, unread and unchanged, and
 * `asset_upload_url` with `asset_upload_authenticity_token` is what tells GitHub the bytes
 * arrived. See `attaching.md` for the whole of the conversation, recorded off their own box.
 */
export const UploadPolicy = Schema.Struct({
  upload_url: Schema.String,
  /** Their signed fields for the storage post. Sent back as they came, in the order they came. */
  form: Schema.Record(Schema.String, Schema.String),
  header: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  asset: Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    href: Schema.String
  }),
  asset_upload_url: Schema.String,
  asset_upload_authenticity_token: Schema.String
})

export type UploadPolicy = typeof UploadPolicy["Type"]

/** What their route answers once the bytes are theirs, of which only the address is wanted. */
export const UploadedAsset = Schema.Struct({
  name: Schema.String,
  href: Schema.String
})

export type UploadedAsset = typeof UploadedAsset["Type"]

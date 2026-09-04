/**
 * A repository's Discussions: the list, one category of it, and one thread.
 *
 * The word this file exists for is Stale. A Question is a discussion in a category that takes
 * answers, and GitHub prints two states on it, Answered and Unanswered. Counted over the first
 * page of eight repositories that run Discussions in earnest on 2026-09-03 — `vercel/next.js`,
 * `tailwindlabs/tailwindcss`, `supabase/supabase`, `vitejs/vite`, `shadcn-ui/ui`, `nuxt/nuxt`,
 * `laravel/framework` and `denoland/deno` — 120 of the 200 rows were Questions, 22 of those were
 * answered, 94 had somebody's reply in them and nothing marked, and 4 had no reply at all.
 *
 * So Unanswered is two states wearing one word, and the larger of the two by a factor of
 * twenty-three. One needs a person to write an answer. The other needs the person who asked to
 * point at an answer that is already sitting there. See `docs/spec/discussions.md`.
 */

import { Option } from "effect"
import { COURTS_WITHOUT_RUNNING, filedByCourt, type Filed } from "./attention"
import type { Court } from "./workingSet"
import type { DiscussionRef } from "./discussionRoutes"

/** One person in a discussion's avatar stack, as their row draws them. */
export type Participant = {
  readonly login: string
  /** Their avatar, or nothing where GitHub's stack drew none. */
  readonly faceUrl: Option.Option<string>
}

export type Emoji =
  | { readonly kind: "none" }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "image"; readonly url: string; readonly name: string }

/**
 * The category a discussion was asked in, as their row prints it.
 *
 * The emoji is theirs and is carried rather than mapped to an Octicon. A maintainer chose it,
 * it is the only thing on GitHub's own row that separates a Poll from a support question at a
 * glance, and there is no icon in the set that means "Turbopack error report".
 */
export type Category = {
  readonly name: string
  /** The last segment of `/discussions/categories/{slug}`, which is what an address takes. */
  readonly slug: string
  readonly emoji: Emoji
}

/**
 * What a discussion is waiting for, which is the fact GitHub has no word for.
 *
 * Four values where GitHub draws three: a filled green check, an outlined grey one, and nothing
 * at all. `stale` is the split of their outlined grey check, and it is 94 of the 98 rows that
 * carry it.
 */
export type Answering =
  /** A Question somebody marked an Answer on. */
  | "answered"
  /** A Question with replies and no Answer. Somebody has to point at one. */
  | "stale"
  /** A Question nobody has replied to at all. Somebody has to write one. */
  | "unanswered"
  /** Not a Question. Its category takes no answers, so there is nothing to be waiting for. */
  | "unanswerable"

/**
 * One discussion as a row, as much of it as a row needs.
 *
 * Every field is on their own list page, so nothing here is absent until a second request
 * lands. `answerable` and `answered` are kept as the two facts their row carries rather than
 * folded into {@link answeringOf} at the edge: the parser's job is to report what the page
 * said, and the conclusion drawn from it belongs to the domain.
 */
export type ListedDiscussion = {
  readonly reference: DiscussionRef
  /**
   * GitHub's own name for it, off the upvote button's id.
   *
   * A number in a repository is not a name GitHub's own writes take. Every mutation on a
   * discussion takes this instead, so a row that can be drawn can also be acted on.
   */
  readonly id: string
  readonly title: string
  readonly url: string
  readonly category: Category
  /** Whether the category takes answers, which is what makes this a Question. */
  readonly answerable: boolean
  /** Whether one of the replies is marked as the Answer. False on anything unanswerable. */
  readonly answered: boolean
  /**
   * Whether somebody closed it, which GitHub added to discussions after answers.
   *
   * Its own field beside {@link ListedDiscussion.answered}, because their row prints both and
   * they are not the same claim. `vercel/next.js` has closed discussions in Ideas, a category
   * that takes no answers at all, and closed Questions that are still unanswered.
   */
  readonly closed: boolean
  readonly locked: boolean
  readonly upvotes: number
  /** Replies of every depth, which is the number their own row prints. */
  readonly comments: number
  readonly author: string
  /**
   * Whatever a maintainer labelled it, in the order their row prints them.
   *
   * Carried because a label is how a maintainer triages, and a row without one loses the only
   * thing on it that somebody put there on purpose. One of the twenty-five rows recorded here
   * has one, which is what a label list looks like on a real repository.
   */
  readonly labels: ReadonlyArray<string>
  /** When it was asked, as their `relative-time` carries it. */
  readonly askedAt: string
  /**
   * Who has been in the thread, in the order their stack draws them.
   *
   * A face rather than only a name, because that is what the row draws, and the same shape the
   * inbox draws for the same reason: on a busy forum the people already in a thread say more
   * about whether it is moving than the reply count does.
   */
  readonly participants: ReadonlyArray<Participant>
  /** Everyone their avatar stack names, the author first. */
}

/**
 * What deciding an Answering and a Court needs, which is less than a whole discussion.
 *
 * The sibling of `workingSet.ts`'s and `issues.ts`'s, and here for the reason theirs are: the
 * rule is one rule, and it is asked twice. A row on the list has these five fields and a
 * discussion's own page has them too, so both are weighed by the same code rather than by two
 * copies of it that drift.
 */
export type Weighing = {
  readonly answerable: boolean
  readonly answered: boolean
  readonly closed: boolean
  readonly locked: boolean
  /** Replies of every depth, which is the number their own row prints. */
  readonly comments: number
}

/**
 * What one discussion is waiting for.
 *
 * Closed and locked are not among the four. Either one finishes a discussion whatever it was
 * waiting for, and that is a Court rather than an Answering: {@link courtOf} reads all three.
 */
export const answeringOf = (one: Weighing): Answering => {
  if (!one.answerable) return "unanswerable"
  if (one.answered) return "answered"
  return one.comments > 0 ? "stale" : "unanswered"
}

/**
 * Which Court a discussion sits in.
 *
 * Needs You is the Stale ones, and on a busy repository it is the biggest group on the screen.
 * That is not a design choice about emphasis; it is the census. A reader who wants their own
 * question rather than the repository's has the category filter and GitHub's own sort, both of
 * which this screen keeps.
 *
 * Running is never returned. No machine works on a discussion: there is no check to run, no
 * build to wait for, and a poll has no closing time to run down to. The Court is left in the
 * vocabulary and off this screen, rather than filled with something that is not a machine
 * working.
 */
export const courtOf = (one: Weighing): Court => {
  // Somebody ended it, or nobody can add to it. Either way nothing is owed on it now, whatever
  // it was waiting for a moment ago. Read before the Answering, because their own rows carry
  // "· Closed · Unanswered" together and the first of those two is the last word.
  if (one.closed || one.locked) return "settled"

  switch (answeringOf(one)) {
    case "stale":
      return "needs-you"
    case "unanswered":
      return "waiting"
    // An answered Question is finished. So is a Show and tell post, an Idea and a Poll: not
    // because the conversation is over, but because nothing is owed, which is what Settled has
    // meant on every other screen of this product.
    case "answered":
    case "unanswerable":
      return "settled"
  }
}

/**
 * Every row in three piles, in the order a reader asks about them.
 *
 * The same filing the inbox does, and it is `filedByCourt` for both rather than a copy each:
 * three Courts because {@link courtOf} can never return Running here, and their own order kept
 * inside each pile.
 */
export const docketsOf = (rows: ReadonlyArray<ListedDiscussion>): ReadonlyArray<Docket> =>
  filedByCourt(rows, courtOf, COURTS_WITHOUT_RUNNING)

/** One Court of a home's discussions, and the rows filed in it. */
export type Docket = Filed<ListedDiscussion>

/**
 * One reply, under one comment.
 *
 * Its own type rather than a comment that happens to have no replies, because GitHub allows
 * exactly one level of nesting: a reply cannot be replied to, and a type that let it would be a
 * type describing a page that cannot exist.
 */
export type Reply = {
  /** GitHub's own name for it, which is what a permalink and every write take. */
  readonly id: string
  readonly author: string
  readonly at: string
  /** Their rendered markdown, as they served it. Empty on a comment GitHub is hiding. */
  readonly body: string
  /**
   * Their own sentence for a comment they have folded away, or nothing for an ordinary one.
   *
   * "This comment was marked as off-topic." and its handful of siblings. GitHub serves neither
   * the author nor the words of one of these, so a read that ignored the state drew eight empty
   * rows on `orgs/community#88425` — which is a thread of thirty comments where eight have been
   * moderated.
   */
  readonly hiddenAs: string
  readonly upvotes: number
  /** The faces on it, in the order their page drew them. Empty where nobody has reacted. */
  readonly reactions: ReadonlyArray<Reaction>
  /**
   * Whether GitHub offered this reader a press to mark it, or to take the mark off.
   *
   * Read off their own page rather than worked out from a permission: the control is on the page
   * when the reader may use it and absent when they may not, and that is a fact rather than a
   * conclusion. See `discussionForms.ts`.
   */
  readonly mayMarkAnswer: boolean
  /** Whether GitHub offered this reader a vote on it. False for everyone who is signed out. */
  readonly mayUpvote: boolean
  /**
   * Whether this is the marked Answer.
   *
   * On a reply as well as on a comment, because the page says so per comment and this reads what
   * the page says. Whether GitHub lets anybody mark a reply is their rule to change, and a read
   * that assumed the answer was always top-level would lose it on the day they do.
   */
  readonly isAnswer: boolean
}

/**
 * One of the eight faces, and how many people put it there.
 *
 * Apart from an upvote, which GitHub keeps apart too: a discussion's upvote is a rank and a
 * reaction is an opinion. Their own page draws them side by side and counts them separately.
 */
export type Reaction = {
  /** GitHub's own name for it, which is what a press sends: `+1`, `heart`, `rocket`. */
  readonly content: string
  /** The character their page drew, so this interface draws the same one. */
  readonly emoji: string
  readonly count: number
  /** Whether this reader is one of them. */
  readonly mine: boolean
  /** Whether GitHub offered this reader a press on it. */
  readonly mayPress: boolean
}

/**
 * One way to answer a Poll, and how many people took it.
 *
 * The share is the number their own page prints beside the option rather than one worked out
 * from the votes. They round it, they round it their way, and a second arithmetic here would
 * disagree with the page a reader has just come from.
 */
export type PollOption = {
  /** GitHub's own id for the option, which is what a vote sends. */
  readonly id: string
  readonly name: string
  /** Their percentage, 0 to 100. */
  readonly share: number
  /** Whether this reader took it. Only ever true on a page GitHub served to somebody signed in. */
  readonly chosen: boolean
}

/**
 * A Poll, which is a discussion whose body carries one.
 *
 * Its own field on the snapshot rather than left inside the body's markup. Their page puts it in
 * a table cell after the comment body, so drawing the body alone would drop it, and drawing the
 * cell as body would hand a reader a poll they cannot vote in.
 *
 * A Poll never closes on its own. That is why Running is empty on the list beside this: there is
 * no clock anywhere in this, and nothing is running down.
 */
export type Poll = {
  readonly question: string
  readonly options: ReadonlyArray<PollOption>
  /** How many people have answered, as their footer counts it. */
  readonly votes: number
  /** Whether GitHub says nobody may answer any more. */
  readonly locked: boolean
  /** Whether GitHub offered this reader a way to answer it. */
  readonly mayVote: boolean
}

/** One comment on a discussion, and the replies underneath it. */
export type Comment = Reply & {
  readonly replies: ReadonlyArray<Reply>
  /** Whether GitHub offered this reader a box to reply under it. */
  readonly mayReply: boolean
}

/**
 * One discussion, whole: what was asked, what everybody said, and which of it was the answer.
 *
 * One read. Their own page is served by Rails with the body and every comment already in it, so
 * unlike a pull request's six requests there is nothing here to defer.
 */
export type DiscussionSnapshot = {
  readonly reference: DiscussionRef
  /** GitHub's own name for the discussion, which every write takes instead of the number. */
  readonly id: string
  readonly title: string
  readonly category: Category
  readonly answerable: boolean
  readonly answered: boolean
  readonly closed: boolean
  readonly locked: boolean
  readonly upvotes: number
  readonly author: string
  readonly askedAt: string
  /** Their rendered markdown for the opening post. */
  readonly body: string
  /** The faces on the question itself. */
  readonly reactions: ReadonlyArray<Reaction>
  readonly comments: ReadonlyArray<Comment>
  /** The Poll their body carries, where the discussion is one. */
  readonly poll: Option.Option<Poll>
  /**
   * What GitHub offered this reader on this page.
   *
   * Every one of these is the presence of one of their own forms. A reader who is not signed in
   * gets none of them, and so does a locked discussion and an archived repository — which is why
   * this is read rather than derived from `locked` and a login.
   */
  readonly allowed: {
    readonly say: boolean
    readonly upvote: boolean
  }
}

/**
 * Every comment of every depth, which is the number a Court is weighed against.
 *
 * Counted rather than taken from a field, because the page never prints one number for it: their
 * header says "6 comments · 3 replies" and their own list row says 9.
 */
export const spokenOn = (snapshot: DiscussionSnapshot): number =>
  snapshot.comments.reduce((sum, one) => sum + 1 + one.replies.length, 0)

/**
 * The five fields the Answering and the Court are decided from, out of a whole discussion.
 *
 * So the page and the row are weighed by one rule. A discussion drawn as Stale on the list and
 * as something else on its own page would be two answers to one question, and the reader would
 * have to decide which of the two screens to believe.
 */
export const weighingOf = (snapshot: DiscussionSnapshot): Weighing => ({
  answerable: snapshot.answerable,
  answered: snapshot.answered,
  closed: snapshot.closed,
  locked: snapshot.locked,
  comments: spokenOn(snapshot)
})

/**
 * The marked Answer, wherever in the thread it is.
 *
 * Looked for among the replies as well as among the comments, for the reason {@link Reply} gives
 * about `isAnswer`. Nothing where none is marked, which is 94 of the 98 unanswered Questions
 * counted across eight repositories.
 */
export const answerOf = (snapshot: DiscussionSnapshot): Option.Option<Reply> => {
  for (const one of snapshot.comments) {
    if (one.isAnswer) return Option.some(one)

    const below = one.replies.find((reply) => reply.isAnswer)
    if (below !== undefined) return Option.some(below)
  }

  return Option.none()
}

/**
 * One entry of the menu GitHub puts behind the button beside a comment.
 *
 * Their word for it and nothing else. Close, lock, edit, delete, report, and whatever they ship
 * next, are all one thing from here: a form in a menu, named by the sentence a person reads
 * before they press it. This codebase learns none of their names, so it cannot be wrong about
 * them and cannot go stale when the list changes.
 */
export type Doing = {
  /** GitHub's own label, exactly as their menu prints it. */
  readonly said: string
  /**
   * Whether GitHub drew it as destructive.
   *
   * Off their own class where they use one, and false where they do not. Read rather than
   * decided, and used to ask for a second press rather than to refuse the first.
   */
  readonly danger: boolean
}

/**
 * Something a reader does to a discussion, as the presses their page offers.
 *
 * One type and not four methods on the port, because they are one act from the gateway's side:
 * find the form GitHub put on the page for this, add whatever the reader typed, send it back.
 * What differs between them is which form, and that is a line of code rather than a method.
 */
export type DiscussionPress =
  /** Say something on the discussion itself. */
  | { readonly kind: "say"; readonly body: string }
  /** Reply under one comment, which is the one level of nesting GitHub allows. */
  | { readonly kind: "reply"; readonly comment: string; readonly body: string }
  /** Mark one comment as the Answer, which is the press this whole screen exists for. */
  | { readonly kind: "mark-answer"; readonly comment: string }
  /** Answer a Poll, by the option's own id. */
  | { readonly kind: "vote"; readonly option: string }
  /**
   * One entry of their own menu, named by the words on it.
   *
   * The label goes back to the gateway, which reads the menu again and sends the form under that
   * label. A round trip through GitHub's own string, which is the only thing either side knows
   * about what the press does.
   */
  | {
      readonly kind: "doing"
      readonly on: "Discussion" | "DiscussionComment"
      readonly id: string
      readonly said: string
    }
  /** Put one of the eight faces on something, or take it off again. */
  | {
      readonly kind: "react"
      readonly on: "Discussion" | "DiscussionComment"
      readonly id: string
      /** GitHub's own name for the face: `+1`, `heart`, `rocket`. */
      readonly content: string
    }
  /** Upvote the question, or something said about it. */
  | {
      readonly kind: "upvote"
      readonly on: "Discussion" | "DiscussionComment"
      /** GitHub's own name for whichever of the two it is. */
      readonly id: string
    }

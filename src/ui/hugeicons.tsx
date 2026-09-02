import {
  Activity03Icon,
  ALargeSmallIcon,
  Alert02Icon,
  AlignHorizontalSpaceBetweenIcon,
  AlignVerticalSpaceBetweenIcon,
  Analytics01Icon,
  Archive02Icon,
  ArrowLeft01Icon,
  ArrowMoveUpRightIcon,
  ArrowRight01Icon,
  Attachment01Icon,
  BoldIcon,
  Book02Icon,
  BotIcon,
  Briefcase01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  CircleDotIcon,
  Clock01Icon,
  CodeIcon,
  Comment01Icon,
  ContrastIcon,
  Copy01Icon,
  DotIcon,
  Download04Icon,
  Edit02Icon,
  ExternalLinkIcon,
  EyeIcon,
  File01Icon,
  Folder01Icon,
  FoldVerticalIcon,
  GitForkIcon,
  GithubIcon,
  GitBranchIcon,
  GitCommitIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  Grid02Icon,
  QueueIcon,
  HighlighterIcon,
  Home07Icon,
  InboxIcon,
  InboxUnreadIcon,
  KanbanIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  Loading03Icon,
  LockIcon,
  Logout01Icon,
  MessageMultiple01Icon,
  MinusSignCircleIcon,
  MoreHorizontalIcon,
  PaintBoardIcon,
  PaintBrush01Icon,
  PaintBucketIcon,
  PinIcon,
  PinOffIcon,
  PlayIcon,
  PlusMinus01Icon,
  PlusSignIcon,
  QuoteDownIcon,
  RepositoryIcon,
  Search01Icon,
  Settings01Icon,
  Shield01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  SlidersHorizontalIcon,
  SplitIcon,
  Tag01Icon,
  TextIndentIcon,
  TextItalicIcon,
  TextWrapIcon,
  Tick02Icon,
  UnfoldMoreIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Art, Set } from "./art";
import { CommandKeyIcon } from "./commandKey";

/**
 * The interface drawn in Hugeicons rather than GitHub's own.
 *
 * The argument for Octicons was recognition: a pull request in this interface was the same shape
 * as the one in the header above it. That header is now ours — the strip, the tabs, the search and
 * the account menu are all drawn here and GitHub's is gated off — so there is no longer a row of
 * their glyphs above ours to match. What is left is cohesion within one interface, which is the
 * same argument the desktop window made, and this is the same set it settled on.
 *
 * One weight, one corner radius, one 24-pixel grid, beside Inter. Named per glyph so the bundle
 * carries thirty-five icons out of five and a half thousand.
 */

/** Octicons take a word for a size as well as a number; Hugeicons take pixels. */
const SIDES = { small: 16, medium: 24, large: 32 } as const;

/**
 * The weight a stroke needs at the size a row draws it.
 *
 * Drawn for 24 pixels and asked for at twelve: 1.5 scaled into 12 renders at three-quarters of a
 * pixel, which a display rounds to a grey suggestion of an icon. Heavier the smaller it gets, so
 * the optical weight matches the text beside it — the only thing an icon in a row has to match.
 */
const weight = (side: number): number =>
  side <= 12 ? 2.4 : side <= 16 ? 2 : 1.6;

/**
 * One Hugeicon, wearing the shape the screens expect.
 *
 * The screens take a component and give it a size and a class, because that is what the set they
 * were written against was. A Hugeicon is one component taking the glyph as a prop, so the
 * adapting happens once here rather than at every call site.
 *
 * `named` is for the one glyph that has to be announced whether or not the caller thought about
 * it. A turning circle is the only thing on the screen saying a check is still running, and a
 * reader who is not looking at it gets nothing from a decoration — so the spinner carries its own
 * name, and a call site that has a better one still wins.
 */
/**
 * The same glyph, turned a quarter of the way round inside its own box.
 *
 * The turn is an attribute on the paths rather than a CSS `rotate`, and that is the whole reason
 * this helper exists. The mark in a stack's gutter is grown from one corner of itself as it
 * arrives — see `.t-stack-linking` in `stack.css` — and a rotation on the element would share
 * `transform-origin` with that keyframe, so turning the glyph would swing it out of its own box.
 * Inside the SVG the box does not move and the corner the animation grows from stays where it is.
 *
 * It earns itself on one glyph. Hugeicons draws `ArrowMoveUpLeft` with its head pointing west,
 * which in a gutter is an arrow aimed past the row above at nothing; `ArrowMoveUpRight` turned
 * anticlockwise ends with the head pointing up, at the row the arrow is about.
 */
const turned = (icon: typeof GitPullRequestIcon, degrees: number): typeof GitPullRequestIcon =>
  icon.map(([tag, attrs]): [string, { [key: string]: string | number }] => [
    tag,
    { ...attrs, transform: `rotate(${degrees} 12 12)` }
  ]);

const from =
  (icon: typeof GitPullRequestIcon, extra?: string, named?: string): Art =>
  ({ size = 16, className, "aria-label": label }) => {
    const side = typeof size === "number" ? size : SIDES[size];
    const classes = [extra, className]
      .filter((one) => one !== undefined)
      .join(" ");
    const name = label ?? named;

    return (
      <HugeiconsIcon
        icon={icon}
        size={side}
        strokeWidth={weight(side)}
        className={classes === "" ? undefined : classes}
        aria-label={name}
        aria-hidden={name === undefined ? true : undefined}
      />
    );
  };

/**
 * What each meaning looks like here.
 *
 * Four worth saying out loud:
 *
 * An issue is a circle with a dot in it and a closed one a circle with a tick, which is the
 * shape GitHub uses and the one thing in this set worth borrowing from them: it is the difference
 * a reader scanning a Court reads without looking.
 *
 * A failing check is a triangle where a passing one is a circle. Not a matched pair of circles,
 * however much tidier: a reader who cannot tell the green from the red has to tell them apart by
 * shape, and this is where that is the difference between a glance and opening every row.
 *
 * A running check turns by our own class rather than anything of Hugeicons': `t-rotate` lives in
 * `motion.css`, which is where the promise to stop for somebody who asked for less motion is kept.
 *
 * `command` is the key itself — the looped square — rather than a picture of a palette, because
 * what the badge in the bar is telling you is which key to press.
 */
export const HUGEICONS: Set = {
  "pull-request": from(GitPullRequestIcon),
  "pull-request-draft": from(GitPullRequestDraftIcon),
  "pull-request-merged": from(GitMergeIcon),
  "merge-commit": from(GitMergeIcon),
  squash: from(GitCommitIcon),
  rebase: from(GitBranchIcon),
  "pull-request-closed": from(GitPullRequestClosedIcon),
  "pull-request-queued": from(QueueIcon),
  issue: from(CircleDotIcon),
  "issue-closed": from(CircleCheckIcon),
  "check-passed": from(CheckmarkCircle02Icon),
  "check-failed": from(Alert02Icon),
  "check-running": from(Loading03Icon, "t-rotate", "Running"),
  "check-queued": from(DotIcon),
  "check-skipped": from(MinusSignCircleIcon),
  comment: from(Comment01Icon),
  comments: from(MessageMultiple01Icon),
  bot: from(BotIcon),
  clock: from(Clock01Icon),
  eye: from(EyeIcon),
  tick: from(Tick02Icon),
  dot: from(DotIcon),
  "chevron-down": from(ChevronDownIcon),
  pinned: from(PinIcon),
  unpin: from(PinOffIcon),
  close: from(Cancel01Icon),
  "working-set": from(InboxIcon),
  notifications: from(InboxIcon),
  // This set has an unread tray of its own, with the mark drawn into the glyph.
  "notifications-unread": from(InboxUnreadIcon),
  repositories: from(RepositoryIcon),
  fork: from(GitForkIcon),
  archived: from(Archive02Icon),
  private: from(LockIcon),
  activity: from(Activity03Icon),
  search: from(Search01Icon),
  create: from(PlusSignIcon),
  home: from(Home07Icon),
  narrow: from(SidebarLeft01Icon),
  widen: from(SidebarRight01Icon),
  work: from(Briefcase01Icon),
  "needs-you": from(ArrowRight01Icon),
  "stacked-on": from(turned(ArrowMoveUpRightIcon, -90)),
  more: from(MoreHorizontalIcon),
  link: from(Link01Icon),
  attach: from(Attachment01Icon),
  /*
   * Ours in both sets, because this shape belongs to the keyboard rather than to a drawing
   * style — the same argument the GitHub mark makes from the other direction. Theirs had no
   * accessible name on it either, so a cap showing only the glyph announced nothing at all.
   * See `commandKey.tsx`.
   */
  command: CommandKeyIcon,
  // Their mark, and the one glyph in this set that is not a style decision:
  // the button wearing it goes to GitHub, so it wears GitHub's own shape.
  github: from(GithubIcon),
  code: from(CodeIcon),
  actions: from(PlayIcon),
  // A board rather than Octicons' table, which is the shape a Project is in now.
  projects: from(KanbanIcon),
  security: from(Shield01Icon),
  insights: from(Analytics01Icon),
  settings: from(Settings01Icon),
  wiki: from(Book02Icon),
  person: from(UserCircleIcon),
  "sign-out": from(Logout01Icon),
  back: from(ArrowLeft01Icon),
  forward: from(ArrowRight01Icon),
  "chevron-right": from(ChevronRightIcon),
  "chevron-up": from(ChevronUpIcon),
  copy: from(Copy01Icon),
  file: from(File01Icon),
  download: from(Download04Icon),
  tag: from(Tag01Icon),
  appearance: from(PaintBrush01Icon),
  files: from(Folder01Icon),
  diff: from(SlidersHorizontalIcon),
  "light-dark": from(ContrastIcon),
  palette: from(PaintBoardIcon),
  glyphs: from(Grid02Icon),
  columns: from(SplitIcon),
  wrap: from(TextWrapIcon),
  "text-size": from(ALargeSmallIcon),
  numbers: from(LeftToRightListNumberIcon),
  fill: from(PaintBucketIcon),
  highlight: from(HighlighterIcon),
  whitespace: from(AlignHorizontalSpaceBetweenIcon),
  fold: from(FoldVerticalIcon),
  unfold: from(UnfoldMoreIcon),
  rows: from(AlignVerticalSpaceBetweenIcon),
  indent: from(TextIndentIcon),
  counts: from(PlusMinus01Icon),
  // A crossed circle where a failing check is a triangle, for the same reason the
  // check pair are different shapes: colour is not the only thing telling them apart.
  error: from(CancelCircleIcon),
  external: from(ExternalLinkIcon),
  bold: from(BoldIcon),
  italic: from(TextItalicIcon),
  quote: from(QuoteDownIcon),
  list: from(LeftToRightListBulletIcon),
  write: from(Edit02Icon),
};

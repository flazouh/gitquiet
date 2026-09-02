/**
 * The four comparison pages. One axis each, from the competitor map: two Chrome
 * side panels, a github.com polish pack, and a hosted notifications inbox.
 *
 * No fifth. Graphite is stacked-PR authoring. GitHush is a secrets scanner.
 * GitQuick is PR analytics. AI review sidebars are a different product. Attention
 * Set is a PAT near-miss on the two side-panel pages (whose-turn popup, Needs you /
 * Waiting), not a URL of its own. Aviator's AttentionSet is a merge queue; skip it.
 * Pullwatch is a read-only toolbar popup named on `/github-pr-inbox`, not a compare
 * URL. The GitHub PR inbox job is that page, not a fifth compare.
 */
export type Compared = {
  readonly slug: string
  readonly name: string
  readonly h1: string
  readonly dek: string
  readonly they: string
  readonly axis: string
  readonly we: string
  readonly themAt: string | undefined
}

export const COMPARED: readonly Compared[] = [
  {
    slug: "prflow",
    name: "PRFlow",
    h1: "In the tab, not a Chrome side panel.",
    dek: "GitQuiet is in the tab on github.com. PRFlow is a Chromium side panel with its own login.",
    they: "PRFlow lives at prflow-ext.com (not prflow.dev). It is a Chromium side panel. It asks for a PAT, and it is read-only. Pull requests sit in role buckets.",
    axis: "The job looks close: a list of pull requests beside GitHub. The surface is not. PRFlow is a panel Chrome draws next to the page. GitQuiet is the page. Attention Set is a PAT near-miss on the same axis: a whose-turn popup (Needs you / Waiting, no Running), not a fifth URL.",
    we: "GitQuiet uses the GitHub session you already have. No extra login, no PAT. Every pull request you are in, across repositories, filed by next action: Needs You, Waiting, Running, Settled. It writes back through GitHub's own routes. This is not an AI reviewer.",
    themAt: "https://prflow-ext.com"
  },
  {
    slug: "github-pr-sidebar",
    name: "GitHub PR Sidebar",
    h1: "One screen, not a side panel and a new tab.",
    dek: "GitQuiet is one screen in the tab. GitHub PR Sidebar is a Chromium side panel; a click opens GitHub in a new tab.",
    they: "GitHub PR Sidebar has no site of its own, only a Chrome listing. It is a Chromium side panel. It asks for a PAT. Groups are thinner. Opening a pull request leaves the panel.",
    axis: "Same job as PRFlow: a list in Chrome's side panel. Same gap: the list is not the place you work, and it needs a token GitQuiet does not. Attention Set is the same PAT near-miss in a whose-turn popup. GitQuiet files by next action, including Running.",
    we: "GitQuiet files every pull request you are in on github.com by next action: Needs You, Waiting, Running, Settled. Existing session. No extra login. Not an AI reviewer.",
    themAt: undefined
  },
  {
    slug: "refined-github",
    name: "Refined GitHub",
    h1: "A queue, not github.com polish.",
    dek: "Refined GitHub adds hundreds of tweaks to github.com. GitQuiet is a queue: every pull request you are in, sorted by next action.",
    they: "Refined GitHub runs on Chrome, Firefox and Safari. It polishes the pages GitHub already draws. It is not a queue, and it does not file your pull requests by next action.",
    axis: "Closest surface: both sit on github.com. Different job. Polish leaves you assembling 'what is owed' from Conversation, Commits, Checks and Files. A queue is that list, already filed.",
    we: "GitQuiet is the queue: Needs You, Waiting, Running, Settled, across repositories, in the tab. No extra login. Not an AI reviewer. Issues, Actions and commits use the same model.",
    themAt: "https://github.com/refined-github/refined-github"
  },
  {
    slug: "octobox",
    name: "Octobox",
    h1: "On github.com, not a hosted inbox.",
    dek: "Octobox is a notifications inbox with its own login and a server. GitQuiet is on github.com, no extra login.",
    they: "Octobox lives at octobox.io. It is a hosted notifications inbox. You sign in separately. Archive state lives on their server.",
    axis: "Both try to stop GitHub's inbox from being the place you work. Octobox takes notifications off github.com. GitQuiet stays on github.com and files the pull requests you are already in.",
    we: "No extra login. Existing GitHub session. Filed by next action, and writes back through GitHub's own routes. Not an AI reviewer, and not a notifications archive.",
    themAt: "https://octobox.io"
  }
]

export const comparedAt = (slug: string): Compared | undefined =>
  COMPARED.find((page) => page.slug === slug)

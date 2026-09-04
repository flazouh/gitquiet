import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type { ReactNode } from "react";
import { listen, socketUrl } from "../github/alive";
import { layer } from "../github/GitHubGateway";
import type { GitHubGateway } from "../ports/GitHubGateway";
import type { Store } from "../ports/Settings";
import { browserSettings } from "../settings/browserStore";
import { ArtProvider } from "../ui/art";
import { PaintedMarkdown } from "../ui/PaintedMarkdown";
import { RegistryProvider } from "../ui/atoms";
import { OCTICONS } from "../ui/octicons";
import { PortraitsProvider } from "../ui/portraits";
import { RendererProvider } from "../ui/renderer";
import { SettingsProvider } from "../ui/settings";
import { ScreenActivityProvider } from "../ui/screenActivity";
import { Theme } from "../ui/Theme";
import { Toasts } from "../ui/Toasts";
import { loadDiffEngine } from "./diffEngine";
import { loadMarkdownHighlighter } from "./markdownHighlighter";
import { loadMarkdownMermaid } from "./markdownMermaid";
import { onGitHub } from "./portraits";

const highlight = (code: string, language: string, theme: string) =>
  loadMarkdownHighlighter.pipe(Effect.flatMap((draw) => draw(code, language, theme)));

const mermaid = (code: string) =>
  loadMarkdownMermaid.pipe(Effect.flatMap((draw) => draw(code)));

/**
 * What a browser extension on github.com can answer, in one file.
 *
 * Four things, and every screen wants the same four: where a reader's choices
 * are kept, who a face belongs to, how to draw a diff, and how to be told the
 * server changed something. Each screen used to name all four and every one of
 * their extension-side answers itself — six or seven imports apiece for
 * decisions no screen makes, and as many chances for one page to end up wired
 * unlike the others.
 *
 * So this is the file another platform rewrites, and the only one. A desktop
 * app keeps settings in a file, loads a renderer by static import, and hears
 * about changes over its own connection; it says all of that here, and every
 * screen above is already asking for the right things.
 */

let holding: AtomRegistry.AtomRegistry | undefined;

/**
 * Where every read on this page is kept, and there is only one of it.
 *
 * A document, not a screen and not a React root. GitHub navigates without
 * loading anything, so a reader going from their list to a pull request and
 * back leaves three roots mounted and unmounted over one page — and the whole
 * point of the registry is that the list the card was opened from is the same
 * read when they come back to it, rather than eight requests to be told what
 * was on the screen a moment ago.
 *
 * Named here rather than left to the fallback inside `atoms.tsx`. That fallback
 * is for a component nobody wrapped, which is a test; a shell that means to
 * share one says so.
 */
const registry = (): AtomRegistry.AtomRegistry =>
  (holding ??= AtomRegistry.make());

let held: Store | undefined;

/**
 * The reader's choices, kept where this platform keeps them.
 *
 * One store for the page rather than one per caller, because two stores over
 * the same synced storage would be two sets of change listeners saying the same
 * thing, and a screen holding a copy that a sibling has already written past.
 */
export const settings = (): Store => (held ??= browserSettings());

/**
 * Runs a read or a write against the GitHub this platform can reach.
 *
 * Which is, here, github.com answering its own private routes because the
 * reader's session cookie rides along with a request made from their page. Every
 * ask a screen makes ends in this, and each of them used to name the adapter
 * that satisfies it — so four screens each said, twenty-one times over, which
 * GitHub is being talked to and how.
 */
export const throughGitHub = <A, E>(
  work: Effect.Effect<A, E, GitHubGateway>,
): Effect.Effect<A, E> => Effect.provide(work, layer);

/**
 * Listens on GitHub's own socket for the channels a payload carries.
 *
 * The address is signed per session and printed in their markup, so a page with
 * none — signed out, or a GitHub that stopped publishing it — is simply not
 * listened to. Nothing else changes: what is on the screen was read on arrival
 * and is read again after every write either way.
 */
export const liveUpdates = (
  channels: ReadonlyArray<string>,
  onFire: () => void,
): (() => void) => {
  if (channels.length === 0) return () => {};

  const url = socketUrl(document);
  if (url === undefined) return () => {};

  return listen({ open: () => new WebSocket(url), channels, onFire });
};

/**
 * Everything above, handed to an interface at its root.
 *
 * A screen that shows no diffs is handed the renderer anyway. It costs nothing:
 * `loadDiffEngine` fetches on first ask, so a list simply never asks. Which is
 * better than a list wired deliberately unlike the others, and then given a
 * diff a year from now by somebody who did not know that.
 */
export const Supplied = ({
  root,
  quiet = false,
  active = true,
  children,
}: {
  /**
   * The container this screen was rendered into, for the pack to be painted on.
   *
   * Named rather than looked up because at the moment this mounts the container
   * is frequently not on the page yet — see `Theme`.
   */
  readonly root?: HTMLElement | undefined;
  /** Omits document-wide surfaces while a route is rendered off the page. */
  readonly quiet?: boolean;
  /** False while a live history entry is detached from the page. */
  readonly active?: boolean;
  readonly children: ReactNode;
}) => (
  <ScreenActivityProvider active={active} root={root}>
  <RegistryProvider registry={registry()}>
    <SettingsProvider store={settings()}>
      {/* Their colours too, for the same reason as their glyphs: this is drawn
          inside their page, and a reader who never opened the settings should
          not be told by the colour that half of it has been replaced. */}
      <Theme element={root} here="github">
        {/* GitHub's own glyphs, for a reader who never opened the settings: this
            interface is standing on their page, under a header drawn in these,
            and the same shape meaning the same thing above and below the fold is
            worth more here than our own drawing style is. The reader can say
            otherwise, and in a window of ours the default is the other way. */}
        <ArtProvider here={OCTICONS}>
        <PortraitsProvider reads={onGitHub}>
          <RendererProvider load={loadDiffEngine}>
            <PaintedMarkdown highlight={highlight} mermaid={mermaid}>
            {/* Above the interface rather than inside a screen: a refusal outlives
                the control that caused it — the menu closed on the press — and on
                some of them it outlives the screen too, a merged pull request being
                a page the reader is about to leave. */}
            {quiet ? children : <Toasts>{children}</Toasts>}
            </PaintedMarkdown>
          </RendererProvider>
        </PortraitsProvider>
        </ArtProvider>
      </Theme>
    </SettingsProvider>
  </RegistryProvider>
  </ScreenActivityProvider>
);

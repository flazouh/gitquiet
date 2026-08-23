import { useEffect, useMemo, useRef, useState } from "react";
import { finding, type Found, type Owed } from "../domain/finding";
import type { Repository } from "../domain/repositories";
import { useArt } from "./art";
import { Cap } from "./Cap";
import { FIELD } from "./dress";
import { Face } from "./Face";

/**
 * Somewhere to type the name of anything you have.
 *
 * Two of their own complaints in one control. Their repository box "only searches for 'recent'
 * repos… you will pull your hair out trying to search for that one repo", and the command
 * palette that did search properly is being taken away — listed at 405 upvotes in their
 * discussion. This searches every repository the reader has and everything the Working Set is
 * owed, out of the cache: no request, no spinner, no debounce, so the answers move with the
 * keystrokes.
 *
 * A combobox over a list of links. The keyboard is still the whole point — it opens on ⌘K
 * with the caret in it, stands on the first answer so Enter is enough, and the arrows walk
 * without wrapping — but each answer is a real anchor, and Enter presses the standing one.
 * The press then leaves this control entirely: the shell answers every link of ours from the
 * top of the document, so a page with a screen swaps in place, and only a page without one
 * costs a load. It was a callback that assigned the address, which made every answer in this
 * list the one control in the interface that always paid for a whole document.
 */
export const Palette = ({
  repositories,
  owed,
  inside,
  onShut,
}: {
  readonly repositories: ReadonlyArray<Repository>;
  readonly owed: ReadonlyArray<Owed>;
  /** The repository being read, where there is one, so a bare number is a pull request in it. */
  readonly inside?: { readonly owner: string; readonly repo: string };
  readonly onShut: () => void;
}) => {
  const art = useArt();
  const Search = art.search;
  const [typed, setTyped] = useState("");
  const [at, setAt] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const found = useMemo(
    () => finding(typed, { repositories, owed, inside }),
    [typed, repositories, owed, inside],
  );

  // Opened by a key, so the caret belongs in it without a press.
  useEffect(() => box.current?.focus(), []);

  const walk = (by: number) =>
    setAt((was) => Math.min(Math.max(was + by, 0), found.length - 1));

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      // Theirs would close their own dialog behind ours, which is not the nearer thing to shut.
      event.stopPropagation();
      onShut();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      walk(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      walk(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      /*
       * A press of the standing answer's own link, rather than a callback beside it.
       * The click leaves the anchor and bubbles to the document, which is where every
       * link of ours is answered — so the keyboard and the pointer go through the one
       * door, and neither can go somewhere the other cannot.
       */
      list.current
        ?.querySelector<HTMLAnchorElement>('a[aria-selected="true"]')
        ?.click();
    }
  };

  return (
    <div
      /*
       * Over the page and above our own bar, pinned near the top rather than centred: a dialog
       * that opens in the middle of the window puts the answers where the reader's eyes are
       * not, and the list grows downwards from where the typing is.
       */
      className="t-palette-veil fixed inset-0 z-40 flex justify-center bg-black/40 pt-20"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onShut();
      }}
    >
      <div
        role="dialog"
        aria-label="Find anything you have"
        aria-modal="true"
        onKeyDown={onKey}
        className="t-palette flex h-fit w-[36rem] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg bg-raised p-1.5 text-ink shadow-2xl"
      >
        <div className={`flex items-center gap-2 px-2 ${FIELD}`}>
          <Search size={14} className="shrink-0 text-ink-muted" />
          <input
            ref={box}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="gitquiet-found"
            aria-label="Find a repository, a pull request or an issue"
            placeholder={
              inside === undefined
                ? "Any repository, or anything owed to you"
                : `Any repository, anything owed to you, or a number in ${inside.repo}`
            }
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setAt(0);
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {/* The way out, as the cap it is everywhere else in the interface. */}
          <span className="flex shrink-0">
            <Cap chord="Escape" />
          </span>
        </div>

        {found.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-ink-muted">
            Nothing here goes by that — and every repository you have is in this list.
          </p>
        ) : (
          <ul
            ref={list}
            id="gitquiet-found"
            role="listbox"
            /*
             * Eight rows and then it scrolls, rather than a dialog that grows to twenty and covers
             * half the page it is meant to be a shortcut into. The walk below keeps the standing
             * row in view, so the arrows still reach the twentieth.
             */
            className="m-0 flex max-h-[17.5rem] list-none flex-col overflow-y-auto p-0"
          >
            {found.map((one, which) => (
              <Answer
                key={one.where}
                one={one}
                standing={which === at}
                onPoint={() => setAt(which)}
                onShut={onShut}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const Answer = ({
  one,
  standing,
  onPoint,
  onShut,
}: {
  readonly one: Found;
  readonly standing: boolean;
  readonly onPoint: () => void;
  readonly onShut: () => void;
}) => {
  const art = useArt();
  const Mark = art[one.kind === "repository" ? "repositories" : one.kind];
  const row = useRef<HTMLLIElement>(null);

  /*
   * Kept in view, now that the list is eight rows tall and holds twenty.
   * `nearest` rather than `center`: it scrolls by one row when walking off the bottom edge and
   * does nothing at all when the row is already visible, so the list does not jump under a
   * reader who is only moving from the first answer to the second.
   */
  useEffect(() => {
    if (standing) row.current?.scrollIntoView({ block: "nearest" });
  }, [standing]);

  return (
    <li ref={row} role="none" onPointerMove={onPoint}>
      {/*
       * A link, and nothing here follows it: the click bubbles to the document, where the
       * shell answers every address it has a screen for and leaves the rest to the browser.
       * Which also makes the row a row — a middle press opens it beside this page, and a
       * copied address is the address it says. The veil shuts behind the press either way.
       */}
      <a
        role="option"
        aria-selected={standing}
        href={one.where}
        onClick={onShut}
        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm no-underline ${
          standing ? "bg-active text-ink" : "text-ink-muted"
        }`}
      >
        {one.faceUrl === undefined ? (
          <Mark size={14} className="shrink-0 text-ink-muted" />
        ) : (
          <Face faceUrl={one.faceUrl} name={one.name} />
        )}
        <span className="min-w-0 flex-1 truncate">{one.name}</span>
        {one.detail === undefined ? null : (
          <span className="shrink-0 font-mono text-xs text-ink-muted">
            {one.detail}
          </span>
        )}
      </a>
    </li>
  );
};

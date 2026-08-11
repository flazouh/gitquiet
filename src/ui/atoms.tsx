import { Effect } from "effect"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useSyncExternalStore } from "react"

/**
 * React, reading what Effect is holding.
 *
 * Effect 4 ships the whole of this underneath — `effect/unstable/reactivity`,
 * which is the package that was called effect-rx and then effect-atom, moved
 * into core. What it does not ship is a way for a component to read one, since
 * nothing in core is allowed to know about React. That is this file, and it is
 * three hooks long.
 *
 * The published binding, `@effect-atom/atom-react`, cannot be installed here:
 * it asks for `effect@^3.19` and this repository is on 4. Two Effects in one
 * bundle is two runtimes, two `Context`s that cannot see each other, and twice
 * the bytes in a content script that loads on every GitHub page.
 */

/**
 * Where the values live.
 *
 * One registry per interface rather than one per screen: it is the thing that
 * lets a list and the card drawn over it be the same read rather than two, and
 * lets a write to one be seen by the other without either knowing it exists.
 */
const Registry = createContext<AtomRegistry.AtomRegistry | undefined>(undefined)

/**
 * The one every screen falls back to.
 *
 * Made on first ask rather than at module load, and shared, so a component
 * drawn in a test — or anywhere else nobody thought to wrap — reads and writes
 * somewhere real instead of throwing about a missing provider.
 */
let ownRegistry: AtomRegistry.AtomRegistry | undefined

const theRegistry = (): AtomRegistry.AtomRegistry => (ownRegistry ??= AtomRegistry.make())

export const RegistryProvider = ({
  registry,
  children
}: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly children: ReactNode
}) => <Registry.Provider value={registry}>{children}</Registry.Provider>

export const useRegistry = (): AtomRegistry.AtomRegistry => useContext(Registry) ?? theRegistry()

/**
 * The three functions `useSyncExternalStore` wants, made once per atom.
 *
 * Per registry and atom rather than per component, in a weak map, which is how
 * the published binding does it: React resubscribes whenever the `subscribe`
 * it is handed changes identity, and a fresh closure from every render of every
 * component reading the same atom is a resubscribe apiece for no change at all.
 */
type Store<A> = {
  readonly subscribe: (changed: () => void) => () => void
  readonly snapshot: () => A
  readonly onTheServer: () => A
}

const stores = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<unknown>, Store<unknown>>>()

const storeFor = <A,>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): Store<A> => {
  let mine = stores.get(registry)
  if (mine === undefined) {
    mine = new WeakMap()
    stores.set(registry, mine)
  }

  const already = mine.get(atom as Atom.Atom<unknown>)
  if (already !== undefined) return already as Store<A>

  const store: Store<A> = {
    subscribe: (changed) => registry.subscribe(atom, changed),
    snapshot: () => registry.get(atom),
    onTheServer: () => Atom.getServerValue(atom, registry)
  }
  mine.set(atom as Atom.Atom<unknown>, store as Store<unknown>)

  return store
}

/**
 * What an atom holds, now and whenever it changes.
 *
 * Through `useSyncExternalStore`, which is the hook React added for exactly
 * this: a value that lives outside React and changes on its own schedule. It
 * handles the two things a `useState` and an effect get wrong — a value that
 * changed between render and subscribe, and a concurrent render tearing across
 * two components reading the same thing.
 */
export const useAtomValue = <A,>(atom: Atom.Atom<A>): A => {
  const store = storeFor(useRegistry(), atom)

  return useSyncExternalStore(store.subscribe, store.snapshot, store.onTheServer)
}

/**
 * The way to write to one, for a component that does not need to read it.
 *
 * Mounted for as long as the component is on the screen, which is not
 * housekeeping: an unmounted atom that is asked to do something arms whatever
 * it was going to do and then never finishes it, so an optimistic write applied
 * through one stands for ever instead of being confirmed or taken back.
 */
export const useAtomSet = <R, W>(
  atom: Atom.Writable<R, W>
): ((value: W | ((held: R) => W)) => void) => {
  const registry = useRegistry()

  useEffect(() => registry.mount(atom), [registry, atom])

  return useCallback(
    (value: W | ((held: R) => W)) =>
      registry.set(
        atom,
        typeof value === "function" ? (value as (held: R) => W)(registry.get(atom)) : value
      ),
    [registry, atom]
  )
}

/** Reads it again from wherever it came from, keeping what is there until it answers. */
export const useAtomRefresh = <A,>(atom: Atom.Atom<A>): (() => void) => {
  const registry = useRegistry()

  useEffect(() => registry.mount(atom), [registry, atom])

  return useCallback(() => registry.refresh(atom), [registry, atom])
}

/**
 * A write whose answer is worth waiting for.
 *
 * `useAtomSet` posts a value and returns; this hands back the answer, so a
 * control that has to say what GitHub said — the row menu repeats a refusal on
 * the item that was pressed — can wait for one without watching the atom.
 *
 * An Effect rather than a promise, which is the same idea as effect-atom's
 * `mode: "promise"` said in the language every write in this codebase is
 * already written in: the caller runs it, and a refusal arrives as a failure
 * rather than as a value that has to be unpacked and checked.
 */
export const useAtomAsk = <Arg, A, E>(
  atom: Atom.AtomResultFn<Arg, A, E>
): ((arg: Arg) => Effect.Effect<A, E>) => {
  const registry = useRegistry()

  useEffect(() => registry.mount(atom), [registry, atom])

  return useCallback(
    (arg: Arg) =>
      Effect.suspend(() => {
        registry.set(atom, arg)
        // Waits for the result to leave `Initial` and through any waiting
        // state, which is the whole of what "has GitHub answered yet" means.
        return AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true })
      }),
    [registry, atom]
  )
}

/** Both halves, in the shape `useState` has trained everybody to expect. */
export const useAtom = <R, W>(atom: Atom.Writable<R, W>): readonly [R, (value: W) => void] => [
  useAtomValue(atom),
  useAtomSet(atom)
]

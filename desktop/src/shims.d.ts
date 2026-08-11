/**
 * Electrobun's Bun API imports its Three.js adapter at the top level, and
 * Three ships no declarations of its own. Nothing here uses it — this is the
 * one line that stops a 3D library nobody asked for failing the typecheck.
 */
declare module "three"

/**
 * A stylesheet imported for its side effect, which is how the bundler is told to
 * emit it. TypeScript wants a declaration for the import even though nothing
 * reads a value from it.
 */
declare module "*.css"

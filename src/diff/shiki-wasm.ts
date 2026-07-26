/**
 * Oniguruma's WASM binary, not shipped.
 *
 * Pierre's highlighter reaches for `import("shiki/wasm")` on one branch of a
 * ternary we never take. A bundler does not know that: it sees the import and
 * inlines the binary, which is about a megabyte of engine for a code path that
 * throws before it is used. This stands in its place.
 */
export default {}

# Change tree selection in one update

The large-PR trace `large-2-after` assigns about 366 ms of sampled time to the tree viewport refresh called by `deselectPath`. GitQuiet currently deselects the old row and then selects the new row. Both changes notify the tree and refresh its viewport.

The tree controller already has `selectOnlyPath`, which replaces selection in one update. Its public `FileTree` wrapper does not expose that method. Use a small Bun dependency patch to expose the existing method and its type. Do not replace the controller or change its selection rules.

1. Add a failing test through the real tree component and its public subscription. A file switch must publish the new selection without an empty intermediate selection. Check the rendered row as well.
2. Expose the existing controller method through the dependency wrapper. Replace GitQuiet's deselect/select loop with that method.
3. Check repeated selection, missing paths, and empty trees. Run the related tests, typecheck, lint, and release build. Review the full patch before keeping it.
4. Compare the candidate with the frozen merged build on the large PR. Check selection CPU work and diff readiness. Keep only a measured improvement without a behavior regression.

This changes the dependency patch metadata, the tree integration, and its regression tests. It does not change file ordering or the delayed heavy diff draw. The next release remains pending until the checks and browser comparison pass.

The regression test failed before the patch: the tree published an empty selection and performed three updates. It passes after the patch, with at most two updates: selection and scrolling. All 4,775 tests pass. A fresh frozen install produces identical patched runtime bytes. Code-quality review found no issue. Browser timing verification is still pending.

# Keep home gating without body-wide style invalidation

The style-invalidation trace names the generated home `body:has(#dashboard.dashboard)` rules when an empty span changes inside GitQuiet. A diagnostic build that replaces only that CSS condition records no body-subtree invalidation in the sampled cycle. The real gate must still wait for the native home dashboard before hiding the page being left.

Use the existing home region selector for finding the screen. Give its CSS stages the plain body surface. For the soft gate, use a body marker maintained by a small document observer. Start it with the shell and stop it on shell invalidation. Read the dashboard by ID and check its class and body membership; do not scan the full page on each update.

1. Test the public gate behavior and generated CSS before implementation. Cover existing home, late insertion, feed, class and ID changes, removal, body replacement, and cleanup.
2. Implement the marker and connect it to the shell. Generate the stylesheets from the place table.
3. Run the related tests and the full checks. Review the complete change for unnecessary state and duplicate ownership.
4. Compare the real candidate with the released behavior. Check style invalidation and home/feed rendering, then repeated small and large PR interactions. Do not ship from the synthetic diagnostic alone.

The DOM expects unique IDs, as GitHub's markup does. A malformed document with duplicate dashboard IDs needs separate evidence before adding fallback scans. No timer is needed: mutation observers run before the next paint. Browser verification must confirm the gate before paint rather than relying on this scheduling rule alone.


Status: implementation and local checks passed in `45870ab`. The candidate trace removed body-subtree invalidation. The full comparison stopped when space 13 disappeared; only one complete small-PR pair and one extra candidate recording remain. Live home/feed checks and the remaining comparisons are pending. No follow-up release is approved by this evidence. See `scripts/performance/RESULTS.md` for the measured results and cleanup uncertainty.

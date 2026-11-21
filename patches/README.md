# patches/

Recorded dependency modifications, as replayable patches — not
undocumented local edits.

## Convention

- One file per modification: `<package>-<short-reason>.patch`.
- Every patch starts with this header (the publish-time check
  `scripts/check-pinned-dependencies.js` enforces it):

  ```
  # Target: <package>@<version>
  # Reason: <why the patch exists, in one line>
  # Recorded: <YYYY-MM-DD>
  ```

- The target must still be at that version in the relevant lockfile.
  A patch whose target moved fails the check until it is updated or
  removed.
- A patch is a record of a modification that was actually made, with
  its reason. A patch without a reason is not a patch.

## Current patches

None. No dependency is currently patched. The first patch must follow
the convention above.

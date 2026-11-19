I don’t have filesystem or shell access in this session, so I haven’t edited either file or run commands.

The required replacement line is:
```ts
"connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com",
```

- **Files:** no edits made to `security-headers.ts` or `security-headers.test.ts`.
- **Vitest:** not run.
- **Git diff / diff stat:** unavailable without worktree access.
- **Commit/push:** none performed.

Please enable filesystem and command-execution tools so I can make the two-file change and return verified test results and the actual diff.
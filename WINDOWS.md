# Windows support

OptMem now runs on native Windows (no WSL required).

## What changed
- `import fcntl` is guarded — falls back to `None` on platforms without it.
- `locked()` uses `msvcrt` advisory locking with spin/backoff when `fcntl`
  is unavailable, so parallel sessions (the documented multi-process case)
  queue instead of raising `Resource deadlock avoided`.
- The `.lock` file is opened in append mode (`"a"`) rather than `"w"`, which
  would truncate and break locks held by other processes on Windows.

## Test (Windows native, no WSL)
```bat
python memo init
set MEMORY_DIR=C:\path\to\mem
python memo note "first memory"
python memo note "second memory"
python memo wake
```
Concurrency: 8 parallel `memo note` processes writing 1600 memories
resulted in 1600/1600 records persisted (lock verified).

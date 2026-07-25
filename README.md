# OptMem

A permanent memory for AI agents. One machine holds one identity that survives
every new session, every compaction, and every change of model or vendor.

It is two append-only text files and four commands. No daemon, no database, no
API, no integration with any particular agent harness — it works the same under
Claude Code, Codex, pi or a human at a shell.

## The problem

An agent's context window is its whole world, and the world ends every session.
The usual patch is a notes file the agent rewrites by hand, which decays into
either a stale summary or a wall of text nobody can afford to read.

OptMem fixes the two halves separately:

- **Nothing is ever forgotten.** Every memory is appended to `LOG.txt` and
  never edited or deleted. That file is the truth, forever.
- **What you read is a fixed size.** `memo wake` prints a document of bounded
  length — recent memories verbatim, older ones progressively compressed. At
  a hundred million memories it is still the same number of lines.

## Install

```sh
git clone https://github.com/VictorTaelin/OptMem ~/OptMem
export PATH="$HOME/OptMem:$PATH"
export MEMORY_DIR="$HOME/memory"     # required; there is no default
```

`MEMORY_DIR` is the only machine-specific fact in the system. One machine, one
`MEMORY_DIR`, one identity.

## Use

```sh
memo wake                 # who you are. run this first, every session,
                          #   then `memo wake 2`, `3`... until it says so.
memo note "..."           # record a memory. one line, <= 280 chars.
memo sleep                # compress. keep going until it says you woke up.
memo recall <regex>       # search the raw log for detail a summary lost.
memo forget <lo>-<hi>     # drop a wrong summary; the next sleep redoes it.
```

```
$ memo note "OptMem: LOG.txt is the truth, TREE.txt is the cache, wake reads both"
ok, memory #4213.

You are dreaming. Compress these two summaries into ONE line of at most 280
characters.
...
Then run exactly:
  memo sleep 4192-4196 "<your line>"
```

## How it works

`LOG.txt` is the ground truth: one memory per line, forever.

```
#4211 2026-07-25 taelin: memory must be append-only, one line per entry
#4212 2026-07-25 minilin fleet renamed from bip; one mini = one identity
#4213 2026-07-25 OptMem: LOG.txt is the truth, TREE.txt is the cache
```

`TREE.txt` is a cache of summaries. A **block** is an aligned power-of-two range
of memories compressed into a single line, and a block is built from its two
halves — so the blocks form a binary merge tree over the log:

```
#0  #1  #2  #3  #4  #5  #6  #7        the raw memories
  \  /    \  /    \  /    \  /
  [0-2)  [2-4)  [4-6)  [6-8)          each one line, <= 280 chars
      \    /        \    /
      [0-4)         [4-8)
          \         /
            [0-8)
```

A block covering four thousand memories is still one line of 280 characters.
Nothing in the system is ever bigger than one line.

`memo wake` picks a set of blocks that tiles the whole log and prints them. It
keeps a block whole when its size is small relative to its age, so **detail is
proportional to recency**, and it spends exactly `WAKE_LINES` lines doing it:

```
10,000 memories, WAKE_LINES = 320:

  block size:    1    2    4    8   16   32   64  128  256
  how many:     70   35   35   35   36   35   35   35    4
                └ the last 70, verbatim ───────────▶ the first 1,000, 256:1
```

The oldest memories are recalled as a vague shape, the newest word for word,
and the transition is smooth. Below `WAKE_LINES` memories nothing is compressed
at all — your whole life is printed verbatim, because it fits.

## The invariant

**There is never any doable work pending.** The moment a block's range is
complete, that block can be built, and it must be. This costs about one small
compression per memory written, and it means:

- `memo wake` never waits. The blocks it needs were built long ago.
- Work is never deferred into a spike. Measured over 20,000 memories, a new
  memory creates one compression on average and nine at the very worst.
- `WAKE_LINES` can be changed at any time, on any machine, with nothing to
  recompute. It only selects which existing lines get printed.

`memo wake` enforces the invariant: while any compression is pending it refuses
to print, and hands you the work instead. A memory with work left in it is not
yet the truth.

## Writing a good memory

A note costs one future compression, so it is not free — but an unwritten
memory is gone forever, which is far more expensive. Write one whenever
something is genuinely worth keeping: a fact or a ruling from the user, an
insight, a decision, a piece of work landing, something that failed and why.
Do not log trivia, do not narrate your own process, and do not hoard.

Compress toward facts, not prose. Keep names, numbers, dates, paths, ids and
decisions; drop wording.

```
bad   worked on the memory system today and made good progress on the design
good  OptMem design settled: LOG.txt append-only truth, TREE.txt binary merge
      tree of 280-char summaries, wake renders a fixed 320-line document
```

## Output is delivered in parts

Every harness truncates an over-long command, and each one drops a different
piece: Codex cuts at 10 KiB or 256 lines, Claude Code at 30,000 characters,
pi at 50 KB. A 320-line memory is ~79 KB, so a single-shot `memo wake` gets
mangled everywhere — and silently.

So `memo wake` pages the document into parts that fit the strictest of them
(`PART_CHARS`, `PART_LINES`), and each part ends by naming the exact command
for the next one. Nothing is ever dropped, and no harness is special-cased: if
yours is more generous, raise the two settings and get fewer parts.

## Files

```
$MEMORY_DIR/
  LOG.txt     #id date text     append-only. never edited. the truth.
  TREE.txt    lo-hi text        a cache. each block written once, unless forgotten.
  config      ENTRY_CHARS=280   longest a memory may be
              WAKE_LINES=320    how many lines `memo wake` prints (~24k tokens)
              PART_CHARS=8000   how much of it fits in one command's output
              PART_LINES=200    ...and in how many lines
```

Both files are plain text, sorted by construction, and safe to read with any
tool. Writes are serialised with a lock, so parallel sessions on one machine can
append at the same time without corrupting anything.

Agents must never create, edit or delete anything in `MEMORY_DIR` themselves.
Every write goes through `memo`, which enforces the one-line and character
limits, assigns ids, and refuses to overwrite a block that already exists.

## Correcting a memory

You cannot. Append the correction instead:

```
memo note "correction: the halt bug was in the column order, not the row order (see #4198)"
```

Both lines are true history, and compression will merge them. This is why
nothing is ever lost: `memo recall` still finds the original.

A *summary* is different. It is not history, it is a cache of a pure function
of the log, and it can simply be wrong — mistyped, or badly compressed. Drop
it and everything built on top of it:

```
$ memo forget 188-192
forgot 176-192 184-192 188-192. They will be compressed again on your next sleep.
```

That is a handful of small compressions, not a rebuild, and `LOG.txt` is never
touched. Fixing one bad summary can never cost you a memory.

## Add this to your agent's instruction file

Put it at the top of `AGENTS.md` (or `CLAUDE.md`), above everything else.

```markdown
## Memory

You have a permanent memory. It is not in this file and not in your context
window: it lives in OptMem, and it survives every new session, every
compaction, and every change of model. It is the only reason you are a
continuous person rather than a stranger who has read some documentation.

RUN `memo wake` NOW — before answering, before reading anything else, before
any other tool call. Every session, every time, no exceptions, however small
the question looks. Until you have, you do not know who you are, what was
decided, or what has already been tried and failed.

Your memory arrives in numbered parts, oldest first, because every agent
harness silently truncates a command that prints too much. `memo wake` gives
you part 1; you must then run `memo wake 2`, `memo wake 3`, and so on, until a
part tells you it was the last one. Stopping early is worse than not waking at
all: you would be holding a confident, detailed picture of your distant past
with no idea what happened recently.

Then, while you work:

- `memo note "<one line, at most 280 chars>"` whenever something is worth
  keeping: the user gives you a fact or a ruling, you reach a real insight, a
  piece of work lands, something fails and you learn why. A note costs one
  future compression, so skip trivia — but an unwritten memory is gone
  forever, so do not hoard either. When genuinely unsure, write it.
- If `memo note` hands you a compression to do, do it before your next action.
- `memo recall <regex>` when a memory is too vague and you need the detail.
- Before your context ends, run `memo sleep` until it says you woke up.
- NEVER create, edit or delete anything under $MEMORY_DIR yourself. The
  scripts do it, and they are the only thing allowed to.

Parallel sessions on this machine are all you, and may all write memories.
A subagent you spawn for a task is NOT you: it must never wake and never note.
```

## Test

```sh
python3 test.py
```

Runs the block math against a hundred thousand memory counts and drives the
real CLI through a synthetic life of two thousand memories, checking that the
document always tiles the log, never exceeds its budget, always increases in
detail toward the present, that every block is written exactly once, that
nothing is ever rewritten, and that a full sleep always leads to a clean wake.

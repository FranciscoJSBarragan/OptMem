# OptMem

A permanent memory for AI agents. One machine holds one identity that survives
every new session, every compaction, and every change of model or vendor.

It is a handful of append-only text files and six commands. No daemon, no database, no
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
memo wake                 # read your memory. run this first, every session,
                          #   then the command each part orders, until one
                          #   prints `You are awake.`
memo note "..."           # record a memory. one line, <= 280 chars.
memo sleep                # compress. answer each prompt until it prints
                          #   `Nothing left to compress.`
memo recall <regex>       # search the raw log for detail a summary lost.
memo forget <lo>-<hi>     # drop a wrong summary; the next sleep redoes it.
```

```
$ memo note "OptMem: LOG.txt is the truth, TREE/ is the cache, wake reads both"
Saved as #4213.

Compress memories #4212-4213 into one line of at most 280 characters.
Keep every name, number, date, decision and outcome.
Drop wording, not facts. Invent nothing.

  #4212 2026-07-25 minilin fleet renamed from bip; one mini = one identity
  #4213 2026-07-25 OptMem: LOG.txt is the truth, TREE/ is the cache, wake reads both

1 compression remains after this one.
Run: memo sleep 4212-4213 "<your line>"
```

## How it works

`LOG.txt` is the ground truth: one memory per line, forever.

```
#4211 2026-07-25 taelin: memory must be append-only, one line per entry
#4212 2026-07-25 minilin fleet renamed from bip; one mini = one identity
#4213 2026-07-25 OptMem: LOG.txt is the truth, TREE/ is the cache
```

`TREE/` is a cache of summaries, one file per block size. A **block** is an
aligned power-of-two range of memories compressed into a single line, and a
block is built from its two halves — so the blocks form a binary merge tree
over the log (a block is named by the inclusive range it covers, `0-1` being
memories #0 and #1):

```
#0  #1  #2  #3  #4  #5  #6  #7        the raw memories
  \  /    \  /    \  /    \  /
  0-1    2-3    4-5    6-7            each one line, <= 280 chars
     \    /        \    /
     0-3            4-7
         \         /
            0-7
```

A block covering four thousand memories is still one line of 280 characters.
Nothing in the system is ever bigger than one line.

`memo wake` picks a set of blocks that tiles the whole log and prints them. It
keeps a block whole when its size is small relative to its age, so **detail is
proportional to recency**, and it spends exactly `WAKE_LINES` lines doing it:

```
10,000 memories, WAKE_LINES = 256:

  block size:    1    2    4    8   16   32   64  128  256
  how many:     54   27   27   27   28   27   27   27   12
                └ the last 54, verbatim ───────────▶ the first 3,000, 256:1
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
good  OptMem design settled: LOG.txt append-only truth, TREE binary merge
      tree of 280-char summaries, wake renders a fixed 256-line document
```

## Output is delivered in parts

Every harness truncates an over-long command, and each one drops a different
piece:

```
  Claude Code  30,000 chars          drops the MIDDLE
  pi           50 KB / 2000 lines    drops the HEAD
  Codex        10,000 tokens         (configurable per call)
```

A 256-line memory is ~64 KB, so a single-shot `memo wake` is mangled
everywhere, and silently.

So `memo wake` pages the document into parts that fit all of them
(`PART_CHARS`, `PART_LINES`), and each part ends by ordering the exact command
for the next one, including the `T` it was rendered at — so a memory written
mid-wake cannot shift a boundary and drop a line. Nothing is special-cased per
harness: if yours is more generous, raise the two settings for fewer parts.

## Files

```
$MEMORY_DIR/
  LOG.txt     #id date text     append-only. never edited. the truth.
  TREE/2      one summary per   a cache of block summaries, one file per block
  TREE/4      record, indexed   size. each block written once, unless forgotten.
  TREE/8      by position
  ...
  config      ENTRY_CHARS=280   longest a memory may be
              WAKE_LINES=256    how many lines `memo wake` prints (~16k tokens)
              PART_CHARS=20000  how much of it fits in one command's output
              PART_LINES=500    ...and in how many lines
```

**Records are fixed width**: 320 bytes in `LOG.txt`, 288 in the `TREE` files.
That is the whole indexing strategy — position *is* identity, so memory `i`
sits at `i*320`, and block `[k*s, (k+1)*s)` sits at `k*288` of `TREE/s`.
Everything is one seek: no scanning, and no index file that could ever
disagree with the data.

```
1,000,000 memories, 607 MB on disk:

  memo wake    0.03s        (scanning the same store: 0.96s)
  memo note    0.02s        (scanning: 1.30s)
  memo sleep   0.02s
```

Finding pending work costs one `stat` per level — about twenty, forever —
because each level file holds a dense prefix, so its length says exactly how
far that level got. Padding costs ~1.6x on disk and buys O(1) on everything.

Both files are still plain text: `grep`, `cat` and `wc -l` all work, lines are
just space-padded. Writes are serialised with a lock, so parallel sessions on
one machine can append at the same time without corrupting anything.

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
$ memo forget 188-191
Forgot 20 summaries, from 188-191 up. Run: memo sleep
```

`LOG.txt` is never touched, so fixing a bad summary can never cost you a
memory. Blocks are built in order, so forgetting one also drops the blocks
built after it at the same levels; they come back on the next sleep.

## Add this to your agent's instruction file

Put it at the top of `AGENTS.md` (or `CLAUDE.md`), above everything else,
adjusting the tool path:

```markdown
## Memory

Your memory is OptMem: the tool is `~/OptMem`, the data is `$MEMORY_DIR`.
It survives every new session, every compaction and every change of model
or vendor. Without it you do not know who you are, or what was already
decided and tried.

Run `memo wake` before any other tool call, in every session. It prints in
numbered parts, each ordering the next; run every one until a part says
`You are awake.` Do not stop early: part 1 is your distant past, the last
part is this week. If wake refuses because compressions are pending, do
them and run `memo wake` again.

While you work:

- `memo note "<one line, max 280 chars>"` when the user gives you a fact or
  a ruling, you reach a real insight, a piece of work lands, or something
  fails and you learn why. Skip trivia; each note costs a future
  compression. Do not hoard either: an unwritten memory is lost. When
  unsure, write it.
- If `memo note` returns a compression, do it before your next action.
- `memo recall <regex>` when a memory is too vague.
- Before your context ends, run `memo sleep` and answer each prompt until
  it prints `Nothing left to compress.`
- Never create, edit or delete anything under `$MEMORY_DIR`. Only `memo`
  writes.

Parallel sessions on this machine are all you, and may all write memories.
A subagent is not: it must never run `memo`, because it cannot judge what
is already known and its notes would arrive duplicated and at the wrong
grain. Start every brief you send one with `You are a subagent. Do not run
memo.` If your own first message is a task brief from another agent, you
are that subagent: skip this section.
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

# OptMem

Permanent memory for AI agents. Nothing is ever deleted, and what the agent
reads at wake is always the same size.

![how OptMem works](anim/optmem.gif)

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/VictorTaelin/OptMem/main/install.sh | sh
```

It prints a `## Memory` block. Paste that at the top of your agent's
`AGENTS.md` (or `CLAUDE.md`), and you are done: no daemon, no database, no
embeddings, no plugin. Run the same line again to update.

## Commands

| | |
|---|---|
| `memo wake` | read the memory — the first command of every session |
| `memo note "..."` | record one memory: one line, up to 280 chars |
| `memo sleep` | answer the merges that came due |
| `memo recall <regex>` | search every memory ever recorded, word for word |
| `memo forget <lo>-<hi>` | drop a bad summary; the next sleep rebuilds it |

Merges arrive one at a time, in the output of `note`. Nothing ever runs in the
background.

## Files

```
~/.optmem/
  memo          the tool (Python 3, no dependencies)
  blocks.py     which memories to read, and which to merge
  memory/
    LOG.txt     every memory, one per line, append-only, never edited
    TREE/       the summaries: a cache, rebuildable from the log alone
    config      the sizes, all commented out
```

`WAKE_LINES` is the only size worth touching: how many lines `wake` prints
(208 ≈ 16k tokens). It is a reading budget, not a storage budget — change it
whenever, in either direction, and nothing is recomputed.

Records are fixed width, so position *is* identity and every lookup is one
seek. At a million memories (607 MB), `wake` takes 0.03s.

Set `$MEMORY_DIR` to keep `memory/` elsewhere — a synced folder, a git repo.

## Limitations

Recency is the only axis: an old memory fades however important it was, and
the one defence is rehearsal — note it again and it is recent again. `recall`
is regex, not semantic search. Summaries are written by the agent out of other
summaries, so a bad one spreads upward until you `forget` it. And a wake costs
~16k tokens, which is deliberate but not free. If you need a fact database,
use a wiki — this is for *who the agent is*.

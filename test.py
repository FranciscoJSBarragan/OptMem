#!/usr/bin/env python3
"""OptMem invariants, checked against a synthetic life of 5000 memories.

Uses a fake compressor (join + truncate) so the run is deterministic and free.
"""

import datetime
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
from blocks import complete, cover  # noqa: E402

N = 2000
WAKE_LINES = 320
ok, fail = 0, 0


def check(cond, msg):
    global ok, fail
    if cond:
        ok += 1
    else:
        fail += 1
        print("FAIL: " + msg)


# ---- pure block math -------------------------------------------------

for T in list(range(1, 400)) + [1000, 4096, 10000, 65536, 100003]:
    c = cover(T, WAKE_LINES)
    check(len(c) <= WAKE_LINES, "T=%d: %d lines > budget" % (T, len(c)))
    check(c[0][0] == 0 and c[-1][1] == T, "T=%d: does not span [0,T)" % T)
    for a, b in zip(c, c[1:]):
        check(a[1] == b[0], "T=%d: gap or overlap at %s %s" % (T, a, b))
    for lo, hi in c:
        s = hi - lo
        check(s & (s - 1) == 0 and lo % s == 0,
              "T=%d: [%d,%d) is not an aligned power-of-two block" % (T, lo, hi))
    for a, b in zip(c, c[1:]):
        check(b[1] - b[0] <= a[1] - a[0],
              "T=%d: detail does not increase toward the present" % T)

check(cover(300, 320) == [(i, i + 1) for i in range(300)],
      "under budget, memory should be verbatim")

# every block a cover ever needs must be buildable
seen = set()
for T in range(1, 3000):
    seen.update(b for b in cover(T, WAKE_LINES) if b[1] - b[0] > 1)
buildable = set(complete(3000))
check(seen <= buildable, "a cover wants a block that complete() never yields")

# work never spikes: naps created by one new memory
worst, prev = 0, 0
for T in range(1, N):
    cur = len(complete(T))
    worst = max(worst, cur - prev)
    prev = cur
check(worst <= 16, "a single memory created %d naps" % worst)

# ---- the real CLI ----------------------------------------------------

d = tempfile.mkdtemp(prefix="optmem-test-")
env = dict(os.environ, MEMORY_DIR=d)
memo = [sys.executable, os.path.join(HERE, "memo")]


def run(*args):
    return subprocess.run(memo + list(args), env=env, capture_output=True,
                          text=True)


r = run("note", "x" * 281)
check(r.returncode == 1 and "REJECTED" in r.stderr, "over-long note accepted")
r = run("note", "two\nlines")
check(r.returncode == 1 and "REJECTED" in r.stderr, "multi-line note accepted")
r = run("note", "   ")
check(r.returncode == 1, "empty note accepted")
check("no memories yet" in run("wake").stdout, "empty wake should say so")

with open(os.path.join(d, "seed.txt"), "w") as f:
    day = datetime.date(2020, 1, 1)
    for i in range(N):
        f.write("%s memory number %d, a thing that happened\n"
                % ((day + datetime.timedelta(days=i // 5)).isoformat(), i))
r = run("import", os.path.join(d, "seed.txt"))
check("imported %d" % N in r.stdout, "import failed: " + r.stdout + r.stderr)

r = run("wake")
check(r.returncode == 1 and "CANNOT WAKE" in r.stdout,
      "wake must refuse while work is pending")

# sleep loop, with a fake compressor
naps = 0
r = run("sleep")
while "You woke up" not in r.stdout:
    line = [l for l in r.stdout.splitlines() if l.strip().startswith("memo sleep ")]
    check(bool(line), "no command offered:\n" + r.stdout + r.stderr)
    if not line:
        break
    bid = line[0].split()[2]
    body = [l.strip() for l in r.stdout.splitlines()
            if l.startswith("  #") or (l.startswith("  ") and l.strip()
                                       and not l.strip().startswith("memo"))]
    r = run("sleep", bid, (" ".join(body)[:280]).strip() or "empty")
    check("REJECTED" not in r.stderr, "sleep rejected a valid nap: " + r.stderr)
    naps += 1
check(naps == len(complete(N)), "did %d naps, expected %d" % (naps, len(complete(N))))

r = run("wake")
check(r.returncode == 0, "wake still refuses after a full sleep")

# the document survives pagination, and every part fits the strictest harness
# output cap in the wild (Codex: 10 KiB or 256 lines)
parts, k = [], 1
while True:
    r = run("wake", str(k))
    if r.returncode != 0:
        break
    body = [l for l in r.stdout.splitlines()
            if not l.startswith("---") and not l.startswith("    ")]
    check(len(r.stdout) < 10240, "part %d is %d bytes, over Codex's 10 KiB cap"
          % (k, len(r.stdout)))
    check(len(r.stdout.splitlines()) < 256, "part %d is over Codex's 256-line cap" % k)
    parts.append(body)
    k += 1
check(len(parts) > 1, "a %d-line memory should need more than one part" % WAKE_LINES)
lines = [l for p in parts for l in p]
check(len(lines) == WAKE_LINES, "woke with %d lines, want %d" % (len(lines), WAKE_LINES))
check(lines[-1].startswith("#%d " % (N - 1)), "newest memory not last / not raw")
check(lines[0].startswith("#0-"), "oldest line should be a summary block")
check("memo wake 2" in run("wake").stdout, "part 1 must name the next command")
check("last one" in run("wake", str(len(parts))).stdout, "last part must say it is last")
check(run("wake", str(len(parts) + 1)).returncode == 1, "a nonexistent part should fail")

# append-only: nothing was ever rewritten
sizes = {f: os.path.getsize(os.path.join(d, f)) for f in ("LOG.txt", "TREE.txt")}
run("note", "one more thing happened today")
for f, s in sizes.items():
    check(os.path.getsize(os.path.join(d, f)) >= s, "%s shrank" % f)
tree = open(os.path.join(d, "TREE.txt")).read().splitlines()
check(len(tree) == len(set(l.split()[0] for l in tree)), "a block was written twice")

# writing a block twice is refused, not duplicated
r = run("sleep", tree[0].split()[0], "attempted overwrite")
check("Already dreamt" in r.stdout, "rewriting a block was allowed")

# recall reaches memories the summaries lost
r = run("recall", "memory number 7,")
check(r.returncode == 0 and "#7 " in r.stdout, "recall missed a memory")

# a wrong summary can be dropped, with everything built on top of it
before = len(open(os.path.join(d, "TREE.txt")).read().splitlines())
logsize = os.path.getsize(os.path.join(d, "LOG.txt"))
r = run("forget", "16-32")
check("16-32" in r.stdout, "forget did not report the block: " + r.stdout + r.stderr)
gone = set(open(os.path.join(d, "TREE.txt")).read().splitlines())
check(not any(l.startswith("16-32 ") for l in gone), "forgotten block still present")
check(not any(l.startswith("0-64 ") for l in gone), "an ancestor survived a forget")
check(os.path.getsize(os.path.join(d, "LOG.txt")) == logsize, "forget touched the log")
check(run("wake").returncode == 1, "wake should refuse after a forget")
n = 0
while "You woke up" not in run("sleep").stdout:
    r = run("sleep")
    bid = [l for l in r.stdout.splitlines() if l.strip().startswith("memo sleep ")][0].split()[2]
    run("sleep", bid, "rebuilt after forget")
    n += 1
check(n == before - len(gone), "rebuilt %d blocks, forgot %d" % (n, before - len(gone)))
check(run("wake").returncode == 0, "wake still refuses after rebuilding")
r = run("forget", "999999-1000000")
check(r.returncode == 1, "forgetting a nonexistent block should fail")

shutil.rmtree(d)
print("\n%d passed, %d failed" % (ok, fail))
sys.exit(1 if fail else 0)

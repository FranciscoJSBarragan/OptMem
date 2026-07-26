"""Block math for OptMem.

A BLOCK is an aligned power-of-two range of memories, [lo, hi), written as one
line of at most ENTRY_CHARS characters. Blocks form a binary merge tree over
LOG.txt: block [lo,hi) is the compression of [lo,mid) and [mid,hi).

Two pure functions matter:

  cover(T, budget)     which blocks `memo wake` prints
  complete(T)          every block that CAN be built, smallest first
"""


def _cover(T, alpha):
    """Tile [0,T) with aligned power-of-two blocks; keep a block whole iff its
    size is at most `alpha` times its age. Bigger alpha = coarser = fewer lines."""
    root = 1
    while root < T:
        root *= 2
    out, stack = [], [(0, root)]
    while stack:
        lo, hi = stack.pop()
        if lo >= T:
            continue
        size = hi - lo
        if size > 1 and (hi > T or size > alpha * (T - lo)):
            mid = (lo + hi) // 2
            stack.append((mid, hi))
            stack.append((lo, mid))
        else:
            out.append((lo, hi))
    out.sort()
    return out


def cover(T, budget):
    """The blocks `memo wake` prints: at most `budget` of them, finest near T.

    Detail decays with age, so recent memories stay verbatim and ancient ones
    collapse. If everything fits, nothing is compressed at all."""
    if T <= 0:
        return []
    if T <= budget:
        return [(i, i + 1) for i in range(T)]
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if len(_cover(T, mid)) > budget:
            lo = mid
        else:
            hi = mid
    out = _cover(T, hi)
    # Block sizes jump in powers of two, so alpha alone can undershoot the
    # budget. Spend what is left on the present, where detail is worth most.
    while len(out) < budget:
        i = max((i for i, b in enumerate(out) if b[1] - b[0] > 1), default=None)
        if i is None:
            break
        lo_, hi_ = out[i]
        mid = (lo_ + hi_) // 2
        out[i:i + 1] = [(lo_, mid), (mid, hi_)]
    return out


def complete(T):
    """Every block buildable from T memories, smallest first (so a block's
    halves always come before it). This is the whole of the work that exists:
    if all of these are in TREE.txt, there is nothing left to do."""
    out = []
    size = 2
    while size <= T:
        for i in range(T // size):
            out.append((i * size, (i + 1) * size))
        size *= 2
    return out

"""Every case the Python vocabulary has to get right, in one file.

Written to be read by `src/ledger/dialects/python.test.ts` and by a person. Each
thing in it is a question a reader asks about a file somebody wrote, and the
three that Python answers differently from TypeScript are the reason this file
exists rather than a translation of `shadowing.ts`.
"""

import os
import os.path as roads
from math import sqrt
from math import sqrt as root
from .local import helper

LIMIT = 10


def area(shape, scale=1):
    """A local shadows a parameter, and both shadow the module's own name."""
    total = shape * scale
    shape = total
    return shape


def outer(shape):
    def inner(shape):
        return shape

    return inner(shape)


class Box:
    size = 4

    def __init__(self, size):
        self.size = size

    def draw(self, n):
        return area(n, self.size)


def loops(rows):
    # A block is not a scope: `found` is written inside the `if` and read after
    # it, and `row` outlives the loop it was written by.
    found = 0
    for row in rows:
        if row > LIMIT:
            found = row
    return found, row


def caught(rows):
    try:
        return rows[0]
    except IndexError as err:
        return err


def held(path):
    with open(path) as handle:
        return handle.read()


def counted(rows):
    # A comprehension is a scope: this `row` is not the one `loops` writes, and
    # it does not leak out of the brackets.
    return [row for row in rows if row > 0]


def walrus(rows):
    if (found := len(rows)) > LIMIT:
        return found
    return 0


doubled = lambda n: n * 2

first, second = 1, 2

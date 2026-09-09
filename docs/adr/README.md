# Architecture decision records

Short documents that record a decision, the constraints that made it right, and the price paid —
so the next person can argue with the reasoning instead of rediscovering it.

| #                                                   | Decision                                       | One-line answer                                                                                                |
| --------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [0001](0001-one-worker-no-durable-objects.md)       | One Worker, no Durable Objects                 | The workload is list-reads and small writes; triggers and KV cover the two places state wanted to live.        |
| [0002](0002-like-search-over-fts5.md)               | `LIKE` over a trigger-built haystack, not FTS5 | Accent-folded substring search beats a young FTS5 in D1 at this corpus size, and swapping later is one column. |
| [0003](0003-sign-up-enumeration.md)                 | Registration discloses "account exists"        | The fact is public by design; rate limit the collection of it, and keep login opaque.                          |
| [0004](0004-derived-counts-in-d1-triggers.md)       | Derived counts in D1 triggers                  | Five write paths cannot keep an aggregate honest; the rows that change it already can.                         |
| [0005](0005-same-origin-cookie-and-derived-csrf.md) | Same-origin cookie + derived CSRF token        | One origin for the browser, no second cookie, and SSR that can see the session.                                |

Write a new record when the choice is (a) expensive to reverse, (b) surprising to a new reader, or
(c) the result of rejecting something reasonable. Number them; never edit one to describe
today's behaviour — add a record that supersedes it and mark the old one `superseded by 000N`.

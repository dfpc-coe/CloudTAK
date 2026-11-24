
# Chat Functionality Fixes (053)
> **Superseded by the v14.1.0 sync.** Upstream replaced the chat implementation, so the code
> this describes is gone, apart from the callsign dest in `api/common/chat/tak.ts`
> (`directChat()`). See the Chat section of [`FORK-DELTA.md`](FORK-DELTA.md). Kept as a record.

> **Historical patch numbers.** The `NNN-name.patch` identifiers used below refer
> to a patch set that was deleted at v13.70.0 — only 8 of its 45 files still
> matched the tree, and 19 pointed at paths upstream had moved. They are kept here
> purely as labels for the work described. The code itself is the source of truth;
> [`FORK-DELTA.md`](FORK-DELTA.md) is the current index of what differs and why.


**Patch:** `053-chat-functionality-fixes.patch`

## Summary

Fixes a handful of TAK.NZ-specific chat issues not covered by upstream v13.26.0. This patch
originally covered a much larger set of fixes (double-stored messages, `isOutgoing` UID
comparison, chat-delete using the wrong column, chatroom naming) but those were independently
fixed by upstream in the meantime, so they were dropped from the patch to avoid re-applying a
no-op diff. Contact-presence fixes (online/offline flood, non-human contacts) now live in
patch 055, not here — see `FORK-DELTA.md`.

## Files Modified

| File | Change |
|------|--------|
| `api/stateful/lib/connection-web.ts` | Add `dest callsign` alongside the existing UID-based `<marti><dest uid="..."/>` so plugins reading `xmlDetail` for a callsign can still route, without breaking TAK Server's collision-free UID-based delivery |
| `app/src/base/chatroom-chats.ts` | `refresh()` merges server messages into local DB instead of delete-then-repopulate, so a locally-sent message isn't dropped if the server hasn't echoed it back yet; `send()` creates the chatroom DB row if it doesn't exist yet instead of assuming it does |
| `app/src/components/CloudTAK/Menu/MenuChat.vue` | Skips the network refresh immediately after navigating from `/new` to the named chatroom post-send, so a stale server-side `updated` timestamp can't roll back the optimistic local state that `send()` just wrote |
| `app/src/components/CloudTAK/Notifications.vue` | Adds `max-width: 90vw` and a `min-width: 0` flex child so the notification panel and its truncated text actually respect their container width on narrow viewports |
| `app/src/workers/atlas-connection.ts` | Replaces `Chatroom.load()` (which calls `fetch()` and fails with 401 inside the worker, silently dropping every incoming chat) with direct IndexedDB writes; adds exponential-backoff reconnect and an auth-failure probe via `/api/login` |

## Issues Fixed

### Server-side Chat
- **Plugin routing vs. collision-safe delivery**: TAK Server plugins that only read `xmlDetail`
  (e.g. tak-gpt) look for a `dest callsign="..."` element. Naively replacing the UID-based dest
  with a callsign-only one is unsafe: TAK Server resolves callsign destinations through a single
  global, non-unique `callsign -> subscription` map, and every new CloudTAK profile defaults to
  the same callsign. `connection-web.ts` now adds the callsign dest via `chat.addDest()` alongside
  the UID dest instead of overwriting it, so TAK Server's UID match (collision-free) still governs
  actual delivery.
- **Removed a redundant, non-standard `<dest>` injection (Jul 2026)**: an earlier revision of this
  patch *also* wrote a bare `<dest callsign="...">` element directly as a sibling under `<detail>`
  (outside `<marti>`), justified by a comment claiming TAK Server strips `<marti>` before building
  `xmlDetail` for plugins. That claim was verified against TAK Server's own source
  (`StreamingProtoBufHelper.cot2protoBuf()` in `takserver-plugins`): it only extracts a fixed
  allowlist of known detail elements (`contact`, `__group`, `precisionlocation`, `status`, `takv`,
  `track`) and passes everything else — including `<marti>` and its children — straight through
  into `xmlDetail` unmodified. So the `<marti><dest callsign="..."/></marti>` from `addDest()`
  alone already lands inside `xmlDetail` intact, and the extra bare sibling `<dest>` was dead
  weight from the start. Removed.

### Client-side Chat
- **Existing conversation shows empty when opened via `/menu/chats/new?callsign=...` (Jul 2026)**:
  every caller that opens a chat from elsewhere in the app (contacts list, mission users, CoT view,
  property creator) routes to `/menu/chats/new?callsign=...&uid=...` regardless of whether that
  contact already has message history — `/new` is only a routing convention meaning "resolve the
  chatroom name from query params instead of the route param," not "this is a brand-new
  conversation." `MenuChat.vue` had two checks gated on the *literal* `'new'` URL segment (the
  local-DB `liveQuery` subscription, and the server `refresh()` call in `fetchChats()`), both of
  which skipped loading any history whenever the URL segment was `new` — even when the resolved
  chatroom name (from the `callsign` query param) had existing messages. Navigating directly via
  `/menu/chats/:chatroom` (bypassing `/new`) worked correctly, since neither check was ever
  triggered. Fixed by keying both checks on the *resolved* chatroom name (`room.value?.name` /
  `newRoom.name`) instead of the URL segment, so history loads regardless of which route was used
  to get there. This bug predates patch 053 (present in the v13.26.0 baseline too, unmodified) but
  is fixed here since this file is already covered by this patch.
- **Locally-sent message dropped on refresh**: `chatroom-chats.ts`'s `refresh()` used to delete
  all local messages for a chatroom before repopulating from the server. If the user had just sent
  a message that TAK Server hadn't echoed back yet, that message would vanish. `refresh()` now
  merges instead of replacing.
- **Wrong message picked for chatroom's "last activity" timestamp (Jul 2026)**: `refresh()` queries
  the server with `order: 'desc', sort: 'created'`, so `list.items[0]` is the newest message and
  `list.items[list.items.length - 1]` is the oldest one in that page. The code was indexing the
  last element, writing the *oldest* message's timestamp into `chatroom.updated` on every refresh.
  Since `MenuChats.vue` sorts the chat list by `updated`, this could make an actively-used
  conversation appear stale and reorder incorrectly in the chat list until the next full
  `Chatroom.sync()` corrected it via the server's `MAX(created)` aggregate. Fixed to index `[0]`.
  This bug predates patch 053 (present in the v13.26.0 baseline too) but is fixed here since this
  is the file that owns `refresh()`.
- **Stale timestamp rollback right after sending the first message**: navigating from `/new` to
  the named chatroom route triggers a `fetchChats()` call, which under most circumstances should
  refresh from the server. Immediately after `send()`, though, that refresh can race the server
  echo and pull back an `updated` timestamp older than what `send()` just wrote locally. The route
  watcher now skips that one refresh when navigating away from `/new` post-send.
- **Notifications panel overflow**: `min-width: 400px` with no `max-width` let the panel grow past
  the viewport on narrow screens, and `text-truncate` alone doesn't truncate without a properly
  constrained flex child.

### Worker/Connection
- **Incoming chat handler crashing in the worker**: `Chatroom.load()` calls `fetch()`, which
  requires cookie/session auth not available inside a Web Worker context, so it threw a 401 and
  aborted the entire incoming-chat handler before the message was stored or a notification fired.
  Replaced with direct `db.chatroom` reads/writes.
- **No reconnect backoff / no auth-failure detection**: added exponential backoff and a
  `/api/login` probe to distinguish "server unreachable" from "session expired," signalling the
  main thread to log the user out only in the latter case.

## Related

Contact-presence fixes (online/offline notification flood, filtering out machine/ETL contacts) are
tracked separately in patch `055-fix-contacts-badge-and-refresh.patch`, not in this patch.

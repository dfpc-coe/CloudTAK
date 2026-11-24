
# Chat Delete Not Reflected Locally (067)
> **Superseded by the v14.1.0 sync.** Upstream replaced the chat implementation, so the code
> this describes is gone, apart from the callsign dest in `api/common/chat/tak.ts`
> (`directChat()`). See the Chat section of [`FORK-DELTA.md`](FORK-DELTA.md). Kept as a record.

> **Historical patch numbers.** The `NNN-name.patch` identifiers used below refer
> to a patch set that was deleted at v13.70.0 — only 8 of its 45 files still
> matched the tree, and 19 pointed at paths upstream had moved. They are kept here
> purely as labels for the work described. The code itself is the source of truth;
> [`FORK-DELTA.md`](FORK-DELTA.md) is the current index of what differs and why.


**Patch:** `067-fix-chat-delete-local-sync.patch`

## Summary

Deleting individual chat messages within a conversation appeared to do nothing: the message
disappeared from the server (Postgres), but kept rendering in the UI until the browser's
IndexedDB was cleared entirely.

## Root Cause

`Chatroom.deleteChats()` (`app/src/base/chatroom.ts`) only called the server
`DELETE /api/profile/chatroom/:chatroom/chat` endpoint. It never removed the corresponding rows
from the local `db.chatroom_chats` IndexedDB table, even on success.

This gap exists in upstream v13.26.0 too, but is invisible there: upstream's
`ChatroomChats.refresh()` deletes *all* local messages for a chatroom and repopulates from the
server on every refresh, so a message deleted server-side simply wouldn't be re-added on the next
refresh — the wholesale wipe-and-repopulate pattern incidentally reconciled deletions as a side
effect.

Patch 053 (`053-chat-functionality-fixes.patch`) changed `refresh()` to merge server messages into
the local DB instead of wiping it first, specifically to stop a message the user had *just sent*
from disappearing before TAK Server echoed it back. That fix was correct and is being kept — but
it removed the only mechanism that was ever reconciling local deletions with the server, and
nothing was added in its place. The result: `deleteChats()`'s pre-existing gap, previously masked,
became directly user-visible.

## Why Not Revert Patch 053's `refresh()` Change Instead

Reverting to delete-then-repopulate on every `refresh()` would reintroduce the original bug (a
just-sent message can vanish before the server echo arrives), which is a more disruptive,
harder-to-reproduce failure than a stale deleted message lingering until the next explicit
delete-and-refresh cycle. A diff-based reconciliation (compare local vs. server message-ID sets on
every refresh) would hit the exact same race, since a just-sent, not-yet-echoed message looks
identical to a deleted message from that comparison's point of view. The correct fix is a targeted
one: reconcile the local DB at the one call site that actually deletes something, not in the
general-purpose refresh path.

## Fix

`Chatroom.deleteChats()` now calls `db.chatroom_chats.bulkDelete(ids)` after the server delete
succeeds, mirroring the pattern already used by the static `Chatroom.delete()` method (whole-
chatroom deletion) a few lines above, which already does `db.chatroom.bulkDelete(names)` after its
own server call.

## Files Modified

| File | Change |
|------|--------|
| `app/src/base/chatroom.ts` | `deleteChats()` now deletes the given message IDs from `db.chatroom_chats` locally after the server delete succeeds |

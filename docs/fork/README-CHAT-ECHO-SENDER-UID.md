
# Chat Echo Missing Sender UID (066)
> **Superseded by the v14.1.0 sync.** Upstream replaced the chat implementation, so the code
> this describes is gone, apart from the callsign dest in `api/common/chat/tak.ts`
> (`directChat()`). See the Chat section of [`FORK-DELTA.md`](FORK-DELTA.md). Kept as a record.

> **Historical patch numbers.** The `NNN-name.patch` identifiers used below refer
> to a patch set that was deleted at v13.70.0 — only 8 of its 45 files still
> matched the tree, and 19 pointed at paths upstream had moved. They are kept here
> purely as labels for the work described. The code itself is the source of truth;
> [`FORK-DELTA.md`](FORK-DELTA.md) is the current index of what differs and why.


**Patch:** `066-fix-chat-echo-missing-sender-uid.patch`

## Summary

Sending a directed chat to a contact (e.g. the `tak-gpt` bot) showed the user's own message as if
it came from the recipient — bubble on the wrong side — until the page was reloaded, at which
point it displayed correctly.

## Root Cause

`ChatroomChats.send()` (`app/src/base/chatroom-chats.ts`) writes an optimistic local copy of
the outgoing message to IndexedDB immediately, with the correct `sender_uid` (the sending user's
own UID). This is what renders the message correctly on the right side the instant it's sent.

TAK Server does not rebroadcast a submitted CoT back to the submitting connection automatically.
Instead, `ConnectionPool.cots()` (`api/stateful/lib/connection-pool.ts`) is invoked directly by the TAK
socket handler for every CoT the server delivers back over the connection, including the sender's
own echoed chat message, and pushes a `type: 'chat'` WebSocket message to the browser so the UI
can react to delivery. That WebSocket payload's `from` object only included `callsign` — not
`uid` — even though the client's `Chat` type (`app/src/types.ts`) declares `from.uid` as
required.

`AtlasConnection` (`app/src/workers/atlas-connection.ts`) stores the incoming WebSocket chat
message via `db.chatroom_chats.put()`, keyed by the same `message_id` as the optimistic local
copy. Since `chat.from.uid` was `undefined`, this put **overwrote** the correct `sender_uid` with
`undefined`. `GenericChat.vue` decides which side to render a bubble on via
`chat.sender_uid !== myUID`; with `sender_uid` now `undefined`, every one of the user's own sent
messages started rendering as if it came from the other party.

On a page reload, chats are fetched fresh from `GET /api/profile/chatroom/:chatroom/chat`, which
reads from the `profile_chats` Postgres table. That table's row was written correctly by the
same `cots()` handler's `ProfileChat.generate()` call, which does have access to
`chatgrp._attributes.uid0` — so the reload always showed the correct sender.

## Fix

Add `uid: feat.properties.chat.chatgrp?._attributes?.uid0` to the `from` object in the WebSocket
`chat` message pushed by `connection-pool.ts`, matching what `ProfileChat.generate()` already
uses a few lines above for the same purpose.

## Additional cleanup (Jul 2026): leftover debug logging

While reviewing the rest of `ConnectionPool.cots()`'s chat handling, found an unconditional
`console.log(JSON.stringify(feat))` that fired for every mission-chat CoT (`parent ===
'DataSyncMissionsList'`), logging the full CoT payload — including message text — to server logs.
This predates our fixes (present in the v13.26.0 baseline too) and has no functional purpose;
removed as log noise / potential data exposure.

## Files Modified

| File | Change |
|------|--------|
| `api/stateful/lib/connection-pool.ts` | Include `from.uid` in the WebSocket `chat` push, not just `from.callsign`; remove leftover debug `console.log` of the full chat CoT payload |

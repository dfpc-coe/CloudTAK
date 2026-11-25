/**
 * The banner above the GPS panel: why this session is not the one sharing the user's location.
 * `paused` (native app) wins: the user chose it and nothing else is true while it holds.
 * `standby` needs the server to have reported a broadcaster state at least once.
 */
export type BroadcastChipMode = 'paused' | 'standby';

export function broadcastChipMode(sharing: {
    paused: boolean;
    standby: boolean;
    broadcastKnown: boolean;
}): BroadcastChipMode | null {
    if (sharing.paused) return 'paused';
    if (sharing.standby && sharing.broadcastKnown) return 'standby';
    return null;
}

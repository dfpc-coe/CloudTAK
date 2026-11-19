/**
 * What the status dot on the Home logo shows about the server connection.
 *
 * A closed connection is not always a problem: after the phone wakes or the user
 * resumes sharing, the app reconnects on its own within seconds, and showing that
 * as a red "disconnected" looks like a failure. So a closed connection that the
 * app is expected to recover from is "reconnecting", and only shows as
 * "disconnected" when there is no reason to expect it to come back soon.
 */
export type ConnectionState = 'paused' | 'connected' | 'reconnecting' | 'disconnected';

/** After this long without a connection, stop calling it "reconnecting" and show it as down */
export const RECONNECT_GRACE_MS = 60_000;

export function connectionState(input: {
    /** The user paused sharing */
    paused: boolean;
    /** The server connection is open */
    isOpen: boolean;
    /** The device has a network connection */
    isOnline: boolean;
    /** When the connection closed, or null if it has not closed since it last opened */
    closedAt: number | null;
    now: number;
}): ConnectionState {
    // The user's choice explains everything else, so it wins
    if (input.paused) return 'paused';
    if (input.isOpen) return 'connected';
    // Nothing to reconnect over
    if (!input.isOnline) return 'disconnected';
    if (input.closedAt !== null && input.now - input.closedAt > RECONNECT_GRACE_MS) return 'disconnected';
    return 'reconnecting';
}

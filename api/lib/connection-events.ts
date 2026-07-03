import WebSocket from 'ws';
import type Config from './config.js';
import type { AuthUser } from './auth.js';

/**
 * Data Types for which sync events are broadcast to a user's connected clients
 */
export enum ConnectionEventDataType {
    OVERLAY = 'overlay',
    FEATURE = 'feature',
    MISSION = 'mission',
    BASEMAP = 'basemap',
    ICONSET = 'iconset',
    PROFILE = 'profile',
}

export enum ConnectionEventAction {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
}

export type ConnectionSyncEvent = {
    type: 'sync';
    data: {
        type: ConnectionEventDataType;
        action: ConnectionEventAction;
        id?: string | number;

        // Optional inline copy of the mutated resource so receiving clients
        // can apply the change directly without a follow-up API fetch
        body?: unknown;
    };
};

/**
 * Construct & Broadcast update events to a user's connected WebSocket clients
 *
 * When an API operation mutates a data type (Overlay, Feature, etc.) from one
 * of a user's connected clients, the remaining clients are sent a `sync`
 * message so they can refresh their local copy of that data type.
 *
 * INVARIANT: The client-side handlers for these events (web/src/workers/
 * atlas-sync.ts) must never write back to a route that broadcasts through
 * this class - session exclusion only suppresses the echo to the originating
 * client, so a handler that POSTs/PATCHes in response to a sync event will
 * bounce sync events between the user's other clients forever.
 *
 * @class
 */
export default class ConnectionEvents {
    /**
     * Construct a sync event message for a given data type & action
     *
     * @param type      - Data Type that was mutated
     * @param action    - Mutation that took place
     * @param id        - Optional ID of the mutated resource
     */
    static event(
        type: ConnectionEventDataType,
        action: ConnectionEventAction,
        id?: string | number,
        body?: unknown,
    ): ConnectionSyncEvent {
        return {
            type: 'sync',
            data: {
                type,
                action,
                ...(id !== undefined ? { id } : {}),
                ...(body !== undefined ? { body } : {}),
            },
        };
    }

    /**
     * Broadcast a sync event to all of a user's connected WebSocket clients
     *
     * @param config        - Server Config
     * @param username      - Username (email) whose clients should be notified
     * @param event         - Event to broadcast
     * @param opts.exclude  - Session ID of the originating client to exclude
     */
    static broadcast(
        config: Config,
        username: string,
        event: ConnectionSyncEvent,
        opts: {
            exclude?: string;
        } = {},
    ): void {
        const clients = config.wsClients.get(username) || [];
        if (!clients.length) return;

        const payload = JSON.stringify(event);

        for (const client of clients) {
            // Don't echo the event back to the client that performed the operation
            if (opts.exclude && client.session && client.session === opts.exclude) continue;
            if (client.ws.readyState !== WebSocket.OPEN) continue;

            try {
                client.ws.send(payload);
            } catch (err) {
                console.error(`Error: Failed to send sync event to client of ${username}:`, err);
            }
        }
    }

    /**
     * Convenience wrapper: construct & broadcast a sync event for a mutation
     * performed by an authenticated user, excluding the session that made the
     * request from the broadcast
     *
     * @param config    - Server Config
     * @param user      - Authenticated User that performed the operation
     * @param type      - Data Type that was mutated
     * @param action    - Mutation that took place
     * @param id        - Optional ID of the mutated resource
     */
    static user(
        config: Config,
        user: AuthUser,
        type: ConnectionEventDataType,
        action: ConnectionEventAction,
        id?: string | number,
        body?: unknown,
    ): void {
        if (!user.email) return;

        this.broadcast(config, user.email, this.event(type, action, id, body), {
            exclude: user.session,
        });
    }
}

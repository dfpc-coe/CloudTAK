import type ConfigStateful from '../config.js';

export const CONNECTION_LINGER_MS = 60000;

const lingering = new Map<string, NodeJS.Timeout>();

/**
 * Keep a profile's TAK Server connection alive briefly after its last
 * WebSocket closes - a mobile client returning from the background reconnects
 * within seconds and would otherwise pay for a full TLS handshake every time
 */
export function scheduleConnectionTeardown(config: ConfigStateful, connection: string, delayMs = CONNECTION_LINGER_MS): void {
    cancelConnectionTeardown(connection);

    lingering.set(connection, setTimeout(() => {
        lingering.delete(connection);
        if (config.wsClients.has(connection)) return;
        config.conns.delete(connection);
    }, delayMs));
}

export function cancelConnectionTeardown(connection: string): boolean {
    const timer = lingering.get(connection);
    if (!timer) return false;

    clearTimeout(timer);
    lingering.delete(connection);
    return true;
}

/*
 * Cross-Tab communication with the Video Wall
 *
 * The Video Wall runs as its own browser tab (video.html => /video). The Map view
 * pushes videos onto the wall and needs to know if a wall tab is already open so it
 * can either notify it to refresh or open a new tab.
 */

import { WorkerMessageType } from '../base/events.ts';
import type { WorkerMessage } from '../base/events.ts';

export const VIDEO_WALL_PATH = '/video';
export const VIDEO_WALL_WINDOW = 'cloudtak-video-wall';

/**
 * Determine if a Video Wall tab is currently open by pinging over the BroadcastChannel
 */
export function isVideoWallOpen(timeout = 500): Promise<boolean> {
    return new Promise((resolve) => {
        const channel = new BroadcastChannel('cloudtak');
        const nonce = crypto.randomUUID();

        const timer = window.setTimeout(() => {
            channel.close();
            resolve(false);
        }, timeout);

        channel.onmessage = (msg: MessageEvent<WorkerMessage>) => {
            if (msg.data && msg.data.type === WorkerMessageType.VideoWall_Pong && msg.data.body.nonce === nonce) {
                window.clearTimeout(timer);
                channel.close();
                resolve(true);
            }
        };

        channel.postMessage({ type: WorkerMessageType.VideoWall_Ping, body: { nonce } });
    });
}

/**
 * Notify an open Video Wall that its contents have changed, or open a new
 * Video Wall tab if one isn't open
 */
export async function notifyVideoWall(): Promise<void> {
    if (await isVideoWallOpen()) {
        const channel = new BroadcastChannel('cloudtak');
        channel.postMessage({ type: WorkerMessageType.VideoWall_Refresh });
        channel.close();
    } else {
        window.open(VIDEO_WALL_PATH, VIDEO_WALL_WINDOW);
    }
}

/**
 * Register the current tab as the Video Wall - responds to pings and invokes
 * the callback when another tab pushes a new video. Returns a cleanup function.
 */
export function registerVideoWall(onRefresh: () => void): () => void {
    const channel = new BroadcastChannel('cloudtak');

    channel.onmessage = (msg: MessageEvent<WorkerMessage>) => {
        if (!msg.data) return;

        if (msg.data.type === WorkerMessageType.VideoWall_Ping) {
            channel.postMessage({ type: WorkerMessageType.VideoWall_Pong, body: { nonce: msg.data.body.nonce } });
        } else if (msg.data.type === WorkerMessageType.VideoWall_Refresh) {
            onRefresh();
        }
    };

    return () => channel.close();
}

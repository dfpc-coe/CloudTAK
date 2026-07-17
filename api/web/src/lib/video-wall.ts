/*
 * Cross-Tab communication with the Video Wall
 *
 * The Video Wall runs as its own browser tab (video.html => /video). The Map view
 * pushes videos onto the wall and needs to know if a wall tab is already open so it
 * can either notify it to refresh or open a new tab.
 */

const CHANNEL_NAME = 'cloudtak:video-wall';

export const VIDEO_WALL_PATH = '/video';
export const VIDEO_WALL_WINDOW = 'cloudtak-video-wall';

type WallMessage = {
    type: 'ping' | 'pong' | 'refresh';
    nonce?: string;
};

/**
 * Determine if a Video Wall tab is currently open by pinging over the BroadcastChannel
 */
export function isVideoWallOpen(timeout = 500): Promise<boolean> {
    return new Promise((resolve) => {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        const nonce = crypto.randomUUID();

        const timer = window.setTimeout(() => {
            channel.close();
            resolve(false);
        }, timeout);

        channel.onmessage = (msg: MessageEvent<WallMessage>) => {
            if (msg.data && msg.data.type === 'pong' && msg.data.nonce === nonce) {
                window.clearTimeout(timer);
                channel.close();
                resolve(true);
            }
        };

        channel.postMessage({ type: 'ping', nonce });
    });
}

/**
 * Notify an open Video Wall that its contents have changed, or open a new
 * Video Wall tab if one isn't open
 */
export async function notifyVideoWall(): Promise<void> {
    if (await isVideoWallOpen()) {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({ type: 'refresh' });
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
    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (msg: MessageEvent<WallMessage>) => {
        if (!msg.data) return;

        if (msg.data.type === 'ping') {
            channel.postMessage({ type: 'pong', nonce: msg.data.nonce });
        } else if (msg.data.type === 'refresh') {
            onRefresh();
        }
    };

    return () => channel.close();
}

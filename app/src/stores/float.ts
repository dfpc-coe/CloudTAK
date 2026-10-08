/*
* FloatStore - Maintain Floating Panes ontop of the Map View
*/

import { defineStore } from 'pinia'
import { markRaw, defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { useMapStore } from './map.ts';
import type { VideoConnection, VideoLease, Attachment, InputFeature } from '../types.ts';

const FloatingVideo = defineAsyncComponent(() => import('../components/CloudTAK/util/FloatingVideo.vue'));
const FloatingAttachment = defineAsyncComponent(() => import('../components/CloudTAK/util/FloatingAttachment.vue'));

export enum VideoStoreType {
    COT = 'cot',
    CONNECTION = 'connection',
    LEASE = 'lease'
}

export type PaneVideoConfig = {
    type: VideoStoreType,
    url?: string,
    lease?: number,
}

export type PaneAttachmentConfig = {
    attachment: Attachment,
}

export type PaneGeoJSONConfig = {
    features: InputFeature[],
}

export type PaneCreateEventConfig = {
    coordinates?: number[],
    location?: string,
    channel?: number,
    navigate?: boolean,
}

export type PaneConfig = Record<string, unknown>;

export type PaneCorner = 'top-left' | 'top-right';

export type Pane<C extends PaneConfig = PaneConfig> = {
    uid: string,
    name?: string,
    component: Component,
    config: C,
    height: number,
    width: number,
    x: number,
    y: number,
}

// Panes open one 8px gutter clear of the 40px-wide left control column (which
// ends at 48px) and of the 60px top bar (which ends at 68px), matching the
// gutters the map chrome uses between itself and the viewport edge.
const PANE_GUTTER = 8;
const PANE_DEFAULT_X = 56;
const PANE_DEFAULT_Y = 76;
const PANE_DEFAULT_WIDTH = 400;
const PANE_DEFAULT_HEIGHT = 300;

// Mirrors Map.vue's --map-side-offset: the visible menu edge is the toast
// offset less its 10px notification buffer.
const TOAST_OFFSET_BUFFER = 10;

// --status-bar-height is a CSS expression over env(), so the native inset
// has to be measured rather than parsed.
function statusBarInset(): number {
    if (typeof document === 'undefined') return 0;

    const probe = document.createElement('div');
    probe.style.cssText = 'position: absolute; visibility: hidden; height: var(--status-bar-height, 0px);';
    document.body.appendChild(probe);
    const height = probe.offsetHeight;
    probe.remove();
    return height;
}

function defaultPosition(corner: PaneCorner = 'top-left', width = PANE_DEFAULT_WIDTH): { x: number, y: number } {
    const y = PANE_DEFAULT_Y + statusBarInset();

    if (corner === 'top-right') {
        const mapStore = useMapStore();
        const sideOffset = Math.max(mapStore.toastOffset.x - TOAST_OFFSET_BUFFER, 0);
        const viewport = typeof window === 'undefined' ? 0 : window.innerWidth;

        return {
            x: Math.max(viewport - sideOffset - PANE_GUTTER - width, PANE_DEFAULT_X),
            y,
        };
    }

    return { x: PANE_DEFAULT_X, y };
}

export const useFloatStore = defineStore('float', {
    state: (): {
        panes: Map<string, Pane>
    } => {
        return {
            panes: new Map()
        }
    },
    actions: {
        delete(uid: string): void {
            this.panes.delete(uid);
        },
        add(opts: {
            uid: string,
            name?: string,
            component: Component,
            config?: PaneConfig,
            height?: number,
            width?: number,
            x?: number,
            y?: number,
            corner?: PaneCorner,
        }): Pane {
            const width = opts.width ?? PANE_DEFAULT_WIDTH;
            const position = defaultPosition(opts.corner, width);

            const pane: Pane = {
                uid: opts.uid,
                name: opts.name,
                component: markRaw(opts.component),
                config: opts.config || {},
                height: opts.height ?? PANE_DEFAULT_HEIGHT,
                width,
                x: opts.x ?? position.x,
                y: opts.y ?? position.y,
            };
            this.panes.set(opts.uid, pane);
            return pane;
        },
        addAttachment(attachment: Attachment) {
            this.panes.set(attachment.hash, {
                uid: attachment.hash,
                component: markRaw(FloatingAttachment),
                config: {
                    attachment,
                },
                height: PANE_DEFAULT_HEIGHT,
                width: PANE_DEFAULT_WIDTH,
                ...defaultPosition(),
            })
        },
        addConnection(connection: VideoConnection): void {
            if (connection.feeds.length === 0) throw new Error('Cannot add Stream as it does not have any valid feeds');

            this.panes.set(connection.uuid, {
                uid: connection.uuid,
                name: connection.alias,
                component: markRaw(FloatingVideo),
                config: {
                    type: VideoStoreType.CONNECTION,
                    url: connection.feeds[0].url,
                },
                height: PANE_DEFAULT_HEIGHT,
                width: PANE_DEFAULT_WIDTH,
                ...defaultPosition(),
            })
        },
        addLease(lease: VideoLease): void {
            const uid = `lease-${lease.id}`;

            this.panes.set(uid, {
                uid,
                name: lease.name,
                component: markRaw(FloatingVideo),
                config: {
                    type: VideoStoreType.LEASE,
                    lease: lease.id,
                },
                height: PANE_DEFAULT_HEIGHT,
                width: PANE_DEFAULT_WIDTH,
                ...defaultPosition(),
            })
        },
        async addCOT(uid: string): Promise<void> {
            const mapStore = useMapStore();
            const cot = await mapStore.worker.db.get(uid, {
                mission: true
            });

            if (!cot || !cot.properties || !cot.properties.video || !cot.properties.video.url) {
                return;
            }

            this.panes.set(uid, {
                uid,
                name: cot.properties.callsign,
                component: markRaw(FloatingVideo),
                config: {
                    type: VideoStoreType.COT,
                    url: cot.properties.video.url,
                },
                height: PANE_DEFAULT_HEIGHT,
                width: PANE_DEFAULT_WIDTH,
                ...defaultPosition(),
            })
        }
    }
})

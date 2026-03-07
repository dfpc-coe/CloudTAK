/*
* FloatStore - Maintain Floating Panes ontop of the Map View
*/

import { defineStore } from 'pinia'
import { markRaw, defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { useMapStore } from './map.ts';
import type { VideoConnection, Attachment } from '../types.ts';

const FloatingVideo = defineAsyncComponent(() => import('../components/CloudTAK/util/FloatingVideo.vue'));
const FloatingAttachment = defineAsyncComponent(() => import('../components/CloudTAK/util/FloatingAttachment.vue'));

export enum VideoStoreType {
    COT = 'cot',
    CONNECTION = 'connection'
}

export type PaneVideoConfig = {
    type: VideoStoreType,
    url: string,
}

export type PaneAttachmentConfig = {
    attachment: Attachment,
}

export type PaneConfig = Record<string, unknown>;

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
        }): Pane {
            const pane: Pane = {
                uid: opts.uid,
                name: opts.name,
                component: markRaw(opts.component),
                config: opts.config || {},
                height: opts.height ?? 300,
                width: opts.width ?? 400,
                x: opts.x ?? 60,
                y: opts.y ?? 40,
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
                height: 300,
                width: 400,
                x: 50,
                y: 60
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
                height: 300,
                width: 400,
                x: 60, // The width of the Nav Toolbar
                y: 40 // The height of the Active Mission / Search Toolbar
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
                height: 300,
                width: 400,
                x: 60, // The width of the Nav Toolbar
                y: 40 // The height of the Active Mission / Search Toolbar
            })
        }
    }
})

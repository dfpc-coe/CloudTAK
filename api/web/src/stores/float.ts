/*
* FloatStore - Maintain Floating Panes ontop of the Map View
*/

import { defineStore } from 'pinia'
import { useMapStore } from './map.ts';
import type { VideoConnection, Attachment } from '../types.ts';
const mapStore = useMapStore();

export enum PaneType {
    VIDEO = 'video',
    ATTACHMENT = 'attachment'
}

export enum VideoStoreType {
    COT = 'cot',
    CONNECTION = 'connection'
}

export type VideoPane = {
    uid: string,
    name?: string,
    type: PaneType.VIDEO,
    config: {
        type: VideoStoreType,
        url: string,
        height: number,
        width: number,
        x: number,
        y: number,
    }
}

export type AttachmentPane = {
    uid: string,
    name?: string,
    type: PaneType.ATTACHMENT,
    config: {
        attachment: Attachment,
        height: number,
        width: number,
        x: number,
        y: number,
    }
}

export const useFloatStore = defineStore('float', {
    state: (): {
        panes: Map<string, VideoPane | AttachmentPane>
    } => {
        return {
            panes: new Map()
        }
    },
    actions: {
        delete(uid: string): void {
            this.panes.delete(uid);
        },
        addAttachment(attachment: Attachment) {
            this.panes.set(attachment.hash, {
                uid: attachment.hash,
                type: PaneType.ATTACHMENT,
                config: {
                    attachment,
                    height: 300,
                    width: 400,
                    x: 60, // The width of the Nav Toolbar
                    y: 0
                }
            })
        },
        addConnection(connection: VideoConnection): void {
            if (connection.feeds.length === 0) throw new Error('Cannot add Stream as it does not have any valid feeds');

            this.panes.set(connection.uuid, {
                uid: connection.uuid,
                name: connection.alias,
                type: PaneType.VIDEO,
                config: {
                    type: VideoStoreType.CONNECTION,
                    url: connection.feeds[0].url,
                    height: 300,
                    width: 400,
                    x: 60, // The width of the Nav Toolbar
                    y: 0
                }
            })
        },
        async addCOT(uid: string): Promise<void> {
            const cot = await mapStore.worker.db.get(uid, {
                mission: true
            });

            if (!cot || !cot.properties || !cot.properties.video || !cot.properties.video.url) {
                return;
            }

            this.panes.set(uid, {
                uid,
                name: cot.properties.callsign,
                type: PaneType.VIDEO,
                config: {
                    type: VideoStoreType.COT,
                    url: cot.properties.video.url,
                    height: 300,
                    width: 400,
                    x: 60, // The width of the Nav Toolbar
                    y: 0
                }
            })
        }
    }
})

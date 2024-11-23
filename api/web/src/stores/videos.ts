/*
* VideoStore - Maintain actively playing videos
*/

import { defineStore } from 'pinia'
import { useCOTStore } from './cots.ts';
import type { VideoConnection } from '../types.ts';
const cotStore = useCOTStore();

export enum VideoStoreType {
    COT = 'cot',
    CONNECTION = 'connection'
}

export const useVideoStore = defineStore('video', {
    state: (): {
        videos: Map<string, {
            uid: string,
            type: VideoStoreType,
            url: string,
            height: number,
            width: number,
            x: number,
            y: number,
        }>
    } => {
        return {
            videos: new Map()
        }
    },
    actions: {
        delete(uid: string): void {
            this.videos.delete(uid);
        },
        addConnection(connection: VideoConnection): void {
            if (connection.feeds.length === 0) throw new Error('Cannot add Stream as it does not have any valid feeds');

            this.videos.set(connection.uuid, {
                uid: connection.uuid,
                type: VideoStoreType.CONNECTION,
                url: connection.feeds[0].url,
                height: 300,
                width: 400,
                x: 60, // The width of the Nav Toolbar
                y: 0
            })
        },
        add(uid: string): void {
            const cot = cotStore.get(uid, {
                mission: true
            });

            if (!cot || !cot.properties || !cot.properties.video || !cot.properties.video.url) {
                return;
            }

            this.videos.set(uid, {
                uid,
                type: VideoStoreType.COT,
                url: cot.properties.video.url,
                height: 300,
                width: 400,
                x: 60, // The width of the Nav Toolbar
                y: 0
            })
        }
    }
})

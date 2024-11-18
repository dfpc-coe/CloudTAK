/*
* VideoStore - Maintain actively playing videos
*/

import { defineStore } from 'pinia'
import { useCOTStore } from './cots.ts';
const cotStore = useCOTStore();

export const useVideoStore = defineStore('video', {
    state: (): {
        videos: Map<string, {
            uid: string,
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
        add(uid: string): void {
            const cot = cotStore.get(uid, {
                mission: true
            });

            if (!cot || !cot.properties || !cot.properties.video || !cot.properties.video.url) {
                return;
            }

            this.videos.set(uid, {
                uid,
                url: cot.properties.video.url,
                height: 300,
                width: 400,
                x: 60, // The width of the Nav Toolbar
                y: 0
            })
        }
    }
})

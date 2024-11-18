/*
* VideoStore - Maintain actively playing videos
*/

import { defineStore } from 'pinia'
import { stdurl } from '../std.ts';
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
        delete(uid) {
            this.videos.delete(uid);
        },
        add(uid: string) {
            const cot = cotStore.get(uid, {
                mission: true
            });

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

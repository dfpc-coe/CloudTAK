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
            x: number,
            y: number,
        }>
    } => {
        return {
            Videos: new Map()
        }
    },
    actions: {
        add(uid: string) {
            this.videos.add(uid, {
                uid,
                x: 0,
                y: 0
            })
        }
    }
})

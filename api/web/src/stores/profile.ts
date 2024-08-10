import type { Feature } from 'geojson';
import { defineStore } from 'pinia'
import { std, stdurl } from '../std.ts';
import type { Profile, Profile_Update } from '../types.ts';

export const useProfileStore = defineStore('profile', {
    state: (): {
        notifications: Array<{
            type: string;
            name: string;
            url: string;
        }>;
        channels: Array<any>;
        profile: Profile | null;
    } => {
        return {
            notifications: [],
            channels: [],
            profile: null,
        }
    },
    getters: {
        hasNoChannels: function(): boolean {
            for (const ch of this.channels) {
                if (ch.active) return false
            }

            return true;
        }
    },
    actions: {
        clearNotifications: function(): void {
            this.notifications = [];
        },
        load: async function(): Promise<void> {
            this.profile = await std('/api/profile');
        },
        loadChannels: async function(): Promise<void> {
            const url = stdurl('/api/marti/group');
            url.searchParams.append('useCache', 'true');
            this.channels = (await std(url)).data;
        },
        update: async function(body: Profile_Update): Promise<void> {
            this.profile = await std('/api/profile', {
                method: 'PATCH',
                body
            })
        },
        CoT: function(feat: Feature) {
            if (!this.profile) throw new Error('Profile must be loaded before CoT is called');

            return {
                // Need to differentiate between servers eventually
                id: `ANDROID-CloudTAK-${this.profile.username}`,
                type: 'Feature',
                properties: {
                    type: 'a-f-G-E-V-C',
                    how: 'm-g',
                    callsign: this.profile.tak_callsign,
                    droid: this.profile.tak_callsign,
                    contact:{
                        endpoint:"*:-1:stcp",
                        callsign: this.profile.tak_callsign,
                    },
                    group: {
                        name: this.profile.tak_group,
                        role: this.profile.tak_role
                    },
                    takv: {
                        device: navigator.userAgent,
                        platform: 'CloudTAK',
                        os: navigator.platform,
                        //TODO Use versions
                        version: '1.0.0'
                    }
                },
                geometry: feat ? feat.geometry : this.profile.tak_loc
            }
        },
    }
})

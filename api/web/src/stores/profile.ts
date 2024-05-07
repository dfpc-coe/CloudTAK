import { defineStore } from 'pinia'
import { std, stdurl } from '../std.ts';
import type { Profile } from '../types.ts';

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
    actions: {
        CoT: function() {
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
                        os: navigator.oscpu,
                        //TODO Use versions
                        version: '1.0.0'
                    }
                },
                geometry: this.profile.tak_loc
            }
        },
        clearNotifications: function() {
            this.notifications = [];
        },
        load: async function() {
            this.profile = await std('/api/profile');
        },
        loadChannels: async function() {
            const url = stdurl('/api/marti/group');
            url.searchParams.append('useCache', 'true');
            this.channels = (await std(url)).data;
        },
        update: async function(body) {
            this.profile = await std('/api/profile', {
                method: 'PATCH',
                body
            })
        }
    }
})

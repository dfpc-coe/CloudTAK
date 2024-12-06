import type { Feature } from 'geojson';
import { defineStore } from 'pinia'
import { std, stdurl } from '../std.ts';
import type { Group, Profile, Profile_Update } from '../types.ts';

export type TAKNotification = {
    type: string;
    name: string;
    body: string;
    url: string;
}

export const useProfileStore = defineStore('profile', {
    state: (): {
        notifications: Array<TAKNotification>;
        channels: Array<Group>;
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
        },
        hasNoConfiguration: function(): boolean {
            if (!this.profile) return false;
            return this.profile.created === this.profile.updated;
        }
    },
    actions: {
        clearNotifications: function(): void {
            this.notifications = [];
        },
        pushNotification: function(notification: TAKNotification): void {
            this.notifications.push(notification);

            if ('Notification' in window && Notification && Notification.permission !== 'denied') {
                const n = new Notification(notification.name, {
                    body: notification.body
                });

                n.onclick = (event) => {
                    event.preventDefault(); // prevent the browser from focusing the Notification's tab
                    console.error(n);
                };

            }
        },
        load: async function(): Promise<void> {
            this.profile = await std('/api/profile') as Profile;
        },
        loadChannels: async function(): Promise<Array<Group>> {
            const url = stdurl('/api/marti/group');
            url.searchParams.append('useCache', 'true');
            this.channels = ((await std(url)) as {
                data: Group[]
            }).data

            return this.channels
        },
        update: async function(body: Profile_Update): Promise<void> {
            this.profile = await std('/api/profile', {
                method: 'PATCH',
                body
            }) as Profile
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

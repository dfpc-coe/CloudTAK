import { defineStore } from 'pinia'
import { std, stdurl } from '../std.ts';
import type { Feature, Group, Profile, Profile_Update } from '../types.ts';
import { useConnectionStore } from './connection.ts';
import { useCOTStore } from './cots.ts';

export type TAKNotification = {
    type: string;
    name: string;
    body: string;
    url: string;
}

export const useProfileStore = defineStore('profile', {
    state: (): {
        // Interval for reporting location to TAK Server
        timerSelf: ReturnType<typeof setInterval> | undefined,
        live_loc: number[] | undefined,
        notifications: Array<TAKNotification>;
        channels: Array<Group>;
        profile: Profile | null;
    } => {
        return {
            timerSelf: undefined,
            live_loc: undefined,
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
        destroy: function(): void {
            if (this.timerSelf) {
                window.clearInterval(this.timerSelf);
                this.timerSelf = undefined;
            }
        },
        setupTimer() {
            const connectionStore = useConnectionStore();

            if (this.timerSelf) {
                window.clearInterval(this.timerSelf);
            }

            this.timerSelf = setInterval(() => {
                if (this.live_loc) {
                    connectionStore.sendCOT(this.CoT(this.live_loc))
                } else if (this.profile && this.profile.tak_loc) {
                    connectionStore.sendCOT(this.CoT());
                }
            }, this.profile ? this.profile.tak_loc_freq : 2000);
        },
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
            if (this.profile && body.tak_loc_freq && this.profile.tak_loc_freq !== body.tak_loc_freq) {
                this.setupTimer();
            }

            this.profile = await std('/api/profile', {
                method: 'PATCH',
                body
            }) as Profile
        },
        uid: function(): string {
            if (!this.profile) throw new Error('Profile must be loaded before CoT is called');

            // Need to differentiate between servers eventually
            return `ANDROID-CloudTAK-${this.profile.username}`;
        },
        CoT: function(coords?: number[]): Feature {
            if (!this.profile) throw new Error('Profile must be loaded before CoT is called');

            const feat: Feature = {
                id: this.uid(),
                path: '/',
                type: 'Feature',
                properties: {
                    id: this.uid(),
                    type: 'a-f-G-E-V-C',
                    how: 'm-g',
                    callsign: this.profile.tak_callsign,
                    remarks: this.profile.tak_remarks,
                    droid: this.profile.tak_callsign,
                    time: new Date().toISOString(),
                    start: new Date().toISOString(),
                    stale: new Date(new Date().getTime() + (1000 * 60)).toISOString(),
                    center: coords || (this.profile.tak_loc ? this.profile.tak_loc.coordinates : [ 0, 0 ]),
                    contact: {
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
                geometry: coords
                    ? { type: 'Point', coordinates: coords }
                    : (this.profile.tak_loc || { type: 'Point', coordinates: [0,0] })
            }

            const cotStore = useCOTStore();
            cotStore.add(feat);

            return feat;
        },
    }
})

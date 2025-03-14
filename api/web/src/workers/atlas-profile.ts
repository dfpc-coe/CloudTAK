import { toRaw } from 'vue';
import type Atlas from './atlas.ts';
import { std, stdurl } from '../std.ts';
import { WorkerMessage } from '../base/events.ts'
import type { Feature, Group, Profile, Profile_Update } from '../types.ts';

export type TAKNotification = {
    type: string;
    name: string;
    body: string;
    url: string;
}

export default class AtlasProfile {
    atlas: Atlas;

    timerSelf: ReturnType<typeof setInterval> | undefined;

    // Interval for reporting location to TAK Server
    live_loc: number[] | undefined;
    channels: Array<Group>;
    profile: Profile | null;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.timerSelf = undefined;
        this.live_loc = undefined;
        this.channels = [];
        this.profile = null;
    }

    async init(): Promise<string> {
        this.setupTimer();

        await Promise.all([
            this.load(),
            this.loadChannels()
        ])

        if (!this.profile) {
            throw new Error('Failed loading profile');
        } else {
            return this.profile.username;
        }
    }

    username(): string {
        if (!this.profile) return '';
        return this.profile.username;
    }

    isSystemAdmin(): boolean {
        if (!this.profile) return false;
        return this.profile.system_admin;
    }

    isAgencyAdmin(): boolean {
        if (!this.profile) return false;
        return this.profile.agency_admin.length > 0;
    }

    hasNoConfiguration(): boolean {
        if (!this.profile) return false;
        return this.profile.created === this.profile.updated;
    }

    hasNoChannels(): boolean {
        for (const ch of this.channels) {
            if (ch.active) return false
        }

        return true;
    }


    destroy(): void {
        if (this.timerSelf) {
            clearInterval(this.timerSelf);
            this.timerSelf = undefined;
        }
    }

    setupTimer() {
        if (this.timerSelf) {
            clearInterval(this.timerSelf);
        }

        this.timerSelf = setInterval(async () => {
            if (this.live_loc) {
                await this.CoT(this.live_loc);
            } else if (this.profile && this.profile.tak_loc) {
                await this.CoT();
            }

            const me = await this.atlas.db.get(this.uid());

            if (me) {
                this.atlas.conn.sendCOT(me.as_feature())
            }
        }, this.profile ? this.profile.tak_loc_freq : 2000);
    }

    pushNotification(notification: TAKNotification): void {
        this.atlas.postMessage({
            type: WorkerMessage.Notification,
            body: notification
        });

        if ('Notification' in self && Notification && Notification.permission !== 'denied') {
            const n = new Notification(notification.name, {
                body: notification.body
            });

            n.onclick = (event) => {
                event.preventDefault(); // prevent the browser from focusing the Notification's tab
                console.error(n);
            };

        }
    }

    async load(): Promise<Profile> {
        if (!this.profile) {
            const profile = await std('/api/profile', {
                token: this.atlas.token
            }) as Profile;

            this.atlas.postMessage({
                type: WorkerMessage.Profile_Callsign,
                body: { callsign: profile.tak_callsign }
            });

            this.profile = profile;
        }

        return this.profile;
    }

    async loadChannels(): Promise<Array<Group>> {
        const url = stdurl('/api/marti/group');
        url.searchParams.append('useCache', 'true');
        this.channels = ((await std(url, {
            token: this.atlas.token
        })) as {
            data: Group[]
        }).data

        if (this.hasNoChannels()) {
            this.atlas.postMessage({ type: WorkerMessage.Channels_None });
        } else {
            this.atlas.postMessage({ type: WorkerMessage.Channels_List });
        }

        return this.channels
    }

    async update(body: Profile_Update): Promise<void> {
        if (this.profile && body.tak_loc_freq && this.profile.tak_loc_freq !== body.tak_loc_freq) {
            this.setupTimer();
        }

        if (body.tak_loc) {
            await this.CoT();
        }

        if (body.tak_callsign) {
            this.atlas.postMessage({
                type: WorkerMessage.Profile_Callsign,
                body: { callsign: body.tak_callsign }
            });
        }

        if (body.display_projection) {
            this.atlas.postMessage({
                type: WorkerMessage.Map_Projection,
                body: { type: body.display_projection }
            });
        }

        this.profile = await std('/api/profile', {
            method: 'PATCH',
            token: this.atlas.token,
            body
        }) as Profile
    }

    uid(): string {
        if (!this.profile) throw new Error('Profile must be loaded before CoT is called');

        // Need to differentiate between servers eventually
        return `ANDROID-CloudTAK-${this.profile.username}`;
    }

    async CoT(coords?: number[]): Promise<void> {
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
                center: coords || (this.profile.tak_loc ? toRaw(this.profile.tak_loc.coordinates) : [ 0, 0 ]),
                contact: {
                    endpoint: '*:-1:stcp',
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
                : (toRaw(this.profile.tak_loc) || { type: 'Point', coordinates: [0,0] })
        }

        await this.atlas.db.add(feat);
    }
}

import { toRaw } from 'vue';
import type Atlas from './atlas.ts';
import { std, stdurl } from '../std.ts';
import { WorkerMessage, LocationState } from '../base/events.ts'
import type { Feature, Group, Profile, Profile_Update } from '../types.ts';

export type TAKNotification = {
    type: string;
    name: string;
    body: string;
    url: string;
}

export type ProfileLocation = {
    source: LocationState
    accuracy: number | undefined
    coordinates: number[]
}

export default class AtlasProfile {
    atlas: Atlas;

    // Interval for reporting location to TAK Server
    timerSelf: ReturnType<typeof setInterval> | undefined;

    location: ProfileLocation;

    channels: Array<Group>;
    profile: Profile | null;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.timerSelf = undefined;

        this.location = {
            source: LocationState.Disabled,
            accuracy: undefined,
            coordinates: [0, 0]
        };

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

    async username(): Promise<string> {
        const profile = await this.load();
        return profile.username;
    }

    async callsign(): Promise<string> {
        const profile = await this.load();
        return profile.tak_callsign;
    }

    async isSystemAdmin(): Promise<boolean> {
        const profile = await this.load();
        return profile.system_admin;
    }

    async isAgencyAdmin(): Promise<boolean> {
        const profile = await this.load();
        return profile.agency_admin.length > 0;
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
            if (this.location.accuracy) {
                await this.CoT(this.location.coordinates);
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

        if (this.profile.tak_loc && this.location.source === LocationState.Disabled) {
            this.location.source = LocationState.Preset;
            this.location.accuracy = undefined;
            this.location.coordinates = this.profile.tak_loc.coordinates;

            this.atlas.postMessage({
                type: WorkerMessage.Profile_Location_Source,
                body: { source: LocationState.Preset }
            });
        }

        return this.profile;
    }

    async setChannel(name: string, active: boolean): Promise<Array<Group>> {
        this.channels.forEach((ch) => {
            if (ch.name === name) ch.active = active;
            return ch;
        });

        await this.atlas.db.clear({
            ignoreArchived: true,
            skipNetwork: false
        })

        return await this.updateChannels(this.channels);        
    }

    async setAllChannels(active: boolean): Promise<Array<Group>> {
        this.channels.forEach((ch) => {
            ch.active = active;
        });

        await this.atlas.db.clear({
            ignoreArchived: true,
            skipNetwork: false
        })

        return await this.updateChannels(this.channels); 
    }

    async updateChannels(channels: Array<Group>): Promise<Array<Group>> {
        this.channels = channels;

        this.postChannelStatus();

        const url = stdurl('/api/marti/group');
        await std(url, {
            method: 'PUT',
            token: this.atlas.token,
            body: this.channels
        });

        return this.channels;
    }

    postChannelStatus(): void {
        if (this.hasNoChannels()) {
            this.atlas.postMessage({ type: WorkerMessage.Channels_None });
        } else {
            this.atlas.postMessage({ type: WorkerMessage.Channels_List });
        }
    }

    async loadChannels(): Promise<Array<Group>> {
        const url = stdurl('/api/marti/group');
        url.searchParams.append('useCache', 'true');
        this.channels = ((await std(url, {
            token: this.atlas.token
        })) as {
            data: Group[]
        }).data

        this.postChannelStatus();

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
                type: WorkerMessage.Projection_Location_Accuracy,
                body: { source: this.location.source }
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

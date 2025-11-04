import { toRaw } from 'vue';
import type Atlas from './atlas.ts';
import { std, stdurl } from '../std.ts';
import { WorkerMessageType, LocationState } from '../base/events.ts'
import type { Feature, Group, Server, Profile, Profile_Update, FeaturePropertyCreator } from '../types.ts';

export type ProfileLocation = {
    source: LocationState
    accuracy: number | undefined
    altitude: number | null | undefined
    coordinates: number[]
}

export default class AtlasProfile {
    atlas: Atlas;

    // Interval for reporting location to TAK Server
    timerSelf: ReturnType<typeof setInterval> | undefined;

    location: ProfileLocation;

    channels: Array<Group>;
    profile: Profile | null;
    server: Server | null;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.timerSelf = undefined;

        this.location = {
            source: LocationState.Disabled,
            accuracy: undefined,
            altitude: undefined,
            coordinates: [0, 0]
        };

        this.channels = [];
        this.profile = null;
        this.server = null;

    }

    async init(): Promise<string> {
        this.setupTimer();

        await Promise.all([
            this.load(),
            this.loadServer(),
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

    async creator(): Promise<FeaturePropertyCreator> {
        return {
            uid: this.uid(),
            type: 'a-f-G-E-V-C',
            callsign: await this.callsign(),
            time: new Date().toISOString(),
        }
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
            // Always send CoT - use GPS coordinates if available, manual location if set, otherwise default to 0,0
            if (this.location.accuracy) {
                await this.CoT(this.location.coordinates, this.location.accuracy, this.location.altitude);
            } else if (this.profile && this.profile.tak_loc) {
                await this.CoT();
            } else {
                // Send 0,0 location when no valid location is available
                await this.CoT([0, 0]);
            }

            const me = await this.atlas.db.get(this.uid());

            if (me) {
                this.atlas.conn.sendCOT(me.as_feature())
            }
        }, this.profile ? this.profile.tak_loc_freq : 2000);
    }

    async loadServer(): Promise<Server> {
        if (!this.server) {
            this.server = await std('/api/server', {
                token: this.atlas.token
            }) as Server;
        }

        return this.server;
    }

    async load(): Promise<Profile> {
        if (!this.profile) {
            const profile = await std('/api/profile', {
                token: this.atlas.token
            }) as Profile;

            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Callsign,
                body: { callsign: profile.tak_callsign }
            });

            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Display_Zoom,
                body: { zoom: profile.display_zoom }
            });

            this.profile = profile;
        }

        this.updateLocation()

        return this.profile;
    }

    updateLocation() {
        if (
            this.profile
            && this.profile.tak_loc
        ) {
            this.location.source = LocationState.Preset;
            this.location.accuracy = undefined;
            this.location.altitude = undefined;
            this.location.coordinates = this.profile.tak_loc.coordinates;

            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Location_Source,
                body: { source: LocationState.Preset }
            });
        } else if (this.profile && !this.profile.tak_loc && this.location.source === LocationState.Preset) {
            // Reset to disabled when manual location is cleared
            this.location.source = LocationState.Disabled;
            this.location.accuracy = undefined;
            this.location.coordinates = [0, 0];

            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Location_Source,
                body: { source: LocationState.Disabled }
            });
        }
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
            this.atlas.postMessage({ type: WorkerMessageType.Channels_None });
        } else {
            this.atlas.postMessage({ type: WorkerMessageType.Channels_List });
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

        // Ensure if network request fails user intent is preserved for session
        if (this.profile) {
            Object.assign(this.profile, body);
        }

        if (body.tak_loc) {
            await this.CoT();
        }

        if (body.tak_callsign) {
            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Callsign,
                body: { callsign: body.tak_callsign }
            });
        }

        if (body.display_zoom) {
            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Display_Zoom,
                body: { zoom: body.display_zoom }
            });
        }

        if (body.display_projection) {
            this.atlas.postMessage({
                type: WorkerMessageType.Map_Projection,
                body: { type: body.display_projection }
            });
        }

        if (body.display_icon_rotation !== undefined) {
            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Icon_Rotation,
                body: { enabled: body.display_icon_rotation }
            });
        }

        if (body.display_distance) {
            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Distance_Unit,
                body: { unit: body.display_distance }
            });
        }

        if (body.tak_loc !== undefined || body.tak_type) {
            this.updateLocation();
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

    async CoT(coords?: number[], accuracy?: number, altitude?: number | null): Promise<void> {
        if (!this.profile || !this.server) throw new Error('Profile must be loaded before CoT is called');

        const coordinates = coords || (this.profile.tak_loc ? toRaw(this.profile.tak_loc.coordinates) : [ 0, 0 ]);
        
        // HAE = Height Above Ellipsoid (altitude), CE = Circular Error (accuracy)
        const hae = altitude !== null && altitude !== undefined ? altitude : 0;

        const uid = this.uid();
       
        const feat: Feature = {
            id: uid,
            path: '/',
            type: 'Feature',
            properties: {
                id: uid,
                type: this.profile.tak_type,
                how: 'm-g',
                callsign: this.profile.tak_callsign,
                remarks: this.profile.tak_remarks,
                droid: this.profile.tak_callsign,
                time: new Date().toISOString(),
                start: new Date().toISOString(),
                stale: new Date(new Date().getTime() + (1000 * 60)).toISOString(),
                center: coordinates,
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
                    version: this.server.version
                },
                hae,
                ...(accuracy !== undefined && { ce: accuracy })
            } as Feature['properties'],
            geometry: { type: 'Point', coordinates: [...coordinates, hae] }
        }

        await this.atlas.db.add(feat);
    }
}

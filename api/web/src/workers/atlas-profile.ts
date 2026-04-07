import type Atlas from './atlas.ts';
import { std } from '../std.ts';
import { WorkerMessageType, LocationState } from '../base/events.ts'
import type { Feature, GroupChannel, Server, Profile, Profile_Update, FeaturePropertyCreator } from '../types.ts';
import ProfileConfig from '../base/profile.ts';
import ServerManager from '../base/server.ts';
import GroupManager from '../base/group.ts';

export type ProfileLocationState = {
    source: LocationState
    accuracy: number | undefined
    altitude: number | null | undefined
    coordinates: number[]
}

export default class AtlasProfile {
    atlas: Atlas;

    // Interval for reporting location to TAK Server
    timerSelf: ReturnType<typeof setInterval> | undefined;

    username: string | null;

    location: ProfileLocationState;

    server: Server | null;

    profile_type?: ProfileConfig<'tak_type'>;
    profile_callsign? : ProfileConfig<'tak_callsign'>;
    profile_remarks? : ProfileConfig<'tak_remarks'>;
    profile_group? : ProfileConfig<'tak_group'>;
    profile_role? : ProfileConfig<'tak_role'>;
    profile_loc?: ProfileConfig<'tak_loc'>;
    profile_loc_freq?: ProfileConfig<'tak_loc_freq'>;
    profile_created?: ProfileConfig<'created'>;
    profile_updated?: ProfileConfig<'updated'>;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.timerSelf = undefined;

        this.username = null;

        this.location = {
            source: LocationState.Disabled,
            accuracy: undefined,
            altitude: undefined,
            coordinates: [0, 0]
        };

        this.server = null;

    }

    async init(): Promise<string> {
        this.setupTimer();

        await Promise.all([
            this.load(),
            this.loadServer(),
            this.loadChannels()
        ])

        this.profile_type = await ProfileConfig.get('tak_type');
        if (this.profile_type) this.profile_type.subscribe();

        this.profile_callsign = await ProfileConfig.get('tak_callsign');
        if (this.profile_callsign) this.profile_callsign.subscribe();

        this.profile_remarks = await ProfileConfig.get('tak_remarks');
        if (this.profile_remarks) this.profile_remarks.subscribe();

        this.profile_group = await ProfileConfig.get('tak_group');
        if (this.profile_group) this.profile_group.subscribe();

        this.profile_role = await ProfileConfig.get('tak_role');
        if (this.profile_role) this.profile_role.subscribe();

        this.profile_loc = await ProfileConfig.get('tak_loc');
        if (this.profile_loc) this.profile_loc.subscribe();

        this.profile_loc_freq = await ProfileConfig.get('tak_loc_freq');
        if (this.profile_loc_freq) this.profile_loc_freq.subscribe();

        this.profile_created = await ProfileConfig.get('created');
        if (this.profile_created) this.profile_created.subscribe();

        this.profile_updated = await ProfileConfig.get('updated');
        if (this.profile_updated) this.profile_updated.subscribe();

        const usernameConfig = await ProfileConfig.get('username');
        if (usernameConfig) {
            this.username = usernameConfig.value;
        }

        this.updateLocation();

        if (this.username) return this.username;
        throw new Error('Failed to load username');
    }

    async creator(): Promise<FeaturePropertyCreator> {
        return {
            uid: this.uid(),
            type: 'a-f-G-E-V-C',
            callsign: this.profile_callsign?.value || 'Unknown',
            time: new Date().toISOString(),
        }
    }

    hasNoConfiguration(): boolean {
        if (!this.profile_created || !this.profile_updated) return false;
        return this.profile_created.value === this.profile_updated.value;
    }

    async hasNoChannels(): Promise<boolean> {
        const channels = await GroupManager.list();
        for (const ch of channels) {
            if (ch.active) return false
        }

        return true;
    }


    destroy(): void {
        if (this.timerSelf) {
            clearInterval(this.timerSelf);
            this.timerSelf = undefined;
        }

        this.profile_type?.destroy();
        this.profile_type = undefined;

        this.profile_callsign?.destroy();
        this.profile_callsign = undefined;

        this.profile_remarks?.destroy();
        this.profile_remarks = undefined;

        this.profile_group?.destroy();
        this.profile_group = undefined;

        this.profile_role?.destroy();
        this.profile_role = undefined;

        this.profile_loc?.destroy();
        this.profile_loc = undefined;

        this.profile_loc_freq?.destroy();
        this.profile_loc_freq = undefined;

        this.profile_created?.destroy();
        this.profile_created = undefined;

        this.profile_updated?.destroy();
        this.profile_updated = undefined;

        this.username = null;
        this.server = null;
        this.location = {
            source: LocationState.Disabled,
            accuracy: undefined,
            altitude: undefined,
            coordinates: [0, 0]
        };
    }

    setupTimer() {
        if (this.timerSelf) {
            clearInterval(this.timerSelf);
        }

        this.timerSelf = setInterval(async () => {
            // Always send CoT - use GPS coordinates if available, manual location if set, otherwise default to 0,0
            if (this.location.accuracy) {
                await this.CoT(this.location.coordinates, this.location.accuracy, this.location.altitude);
            } else if (this.profile_loc && this.profile_loc.value) {
                await this.CoT();
            } else {
                // Send 0,0 location when no valid location is available
                await this.CoT([0, 0]);
            }

            const me = await this.atlas.db.get(this.uid());

            if (me) {
                this.atlas.conn.sendCOT(me.as_feature())
            }
        }, (this.profile_loc_freq && this.profile_loc_freq.value) ? Number(this.profile_loc_freq.value) : 5000);
    }

    async loadServer(): Promise<Server> {
        if (!this.server) {
            this.server = await ServerManager.get(this.atlas.token);
        }

        return this.server;
    }

    async load(): Promise<void> {
        if (!this.username) {
            await this.loadServer();

            await ProfileConfig.sync({
                token: this.atlas.token
            });

            const callsign = await ProfileConfig.get('tak_callsign');
            const display_zoom = await ProfileConfig.get('display_zoom');

            if (callsign) {
                this.atlas.postMessage({
                    type: WorkerMessageType.Profile_Callsign,
                    body: { callsign: callsign.value }
                });
            }

            if (display_zoom) {
                this.atlas.postMessage({
                    type: WorkerMessageType.Profile_Display_Zoom,
                    body: { zoom: display_zoom.value }
                });
            }

            const usernameConfig = await ProfileConfig.get('username');
            if (usernameConfig) {
                 this.username = usernameConfig.value;
            }
        }

        this.updateLocation()
    }

    updateLocation() {
        if (
            this.profile_loc
            && this.profile_loc.value
        ) {
            this.location.source = LocationState.Preset;
            this.location.accuracy = undefined;
            this.location.altitude = undefined;
            this.location.coordinates = (this.profile_loc.value as { coordinates: number[] }).coordinates;

            this.atlas.postMessage({
                type: WorkerMessageType.Profile_Location_Source,
                body: { source: LocationState.Preset }
            });
        } else if ((!this.profile_loc || !this.profile_loc.value) && this.location.source === LocationState.Preset) {
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

    async setChannel(name: string, active: boolean): Promise<Array<GroupChannel>> {
        const channels = await GroupManager.list();
        channels.forEach((ch) => {
            if (ch.name === name) ch.active = active;
        });

        await this.atlas.db.clear({
            ignoreArchived: true,
            skipNetwork: false
        })

        return await this.updateChannels(channels);
    }

    async setAllChannels(active: boolean): Promise<Array<GroupChannel>> {
        const channels = await GroupManager.list();
        channels.forEach((ch) => {
            ch.active = active;
        });

        await this.atlas.db.clear({
            ignoreArchived: true,
            skipNetwork: false
        })

        return await this.updateChannels(channels);
    }

    async updateChannels(channels: Array<GroupChannel>): Promise<Array<GroupChannel>> {
        await this.postChannelStatus();

        await GroupManager.update(channels, this.atlas.token);

        return channels;
    }

    async postChannelStatus(): Promise<void> {
        if (await this.hasNoChannels()) {
            this.atlas.postMessage({ type: WorkerMessageType.Channels_None });
        } else {
            this.atlas.postMessage({ type: WorkerMessageType.Channels_List });
        }
    }

    async loadChannels(): Promise<Array<GroupChannel>> {
        const channels = await GroupManager.list({ token: this.atlas.token });

        await this.postChannelStatus();

        return channels;
    }

    async update(body: Profile_Update): Promise<void> {
        if (!this.username) throw new Error('Profile must be loaded before update');

        let freqChanged = false;
        if (body.tak_loc_freq && this.profile_loc_freq && this.profile_loc_freq.value !== body.tak_loc_freq) {
            freqChanged = true;
        }

        const profile = await std('/api/profile', {
            method: 'PATCH',
            token: this.atlas.token,
            body
        }) as Profile;

        await ProfileConfig.saveAll(profile);

        if (freqChanged) {
            this.setupTimer();
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
    }

    uid(): string {
        if (!this.username) throw new Error('Profile must be loaded before CoT is called');

        // Need to differentiate between servers eventually
        return `ANDROID-CloudTAK-${this.username}`;
    }

    async CoT(coords?: number[], accuracy?: number, altitude?: number | null): Promise<void> {
        if (!this.server) throw new Error('Profile must be loaded before CoT is called');

        let coordinates: number[] | null = coords || null;
        if (!coordinates) {
            if (this.profile_loc && this.profile_loc.value && (this.profile_loc.value as { coordinates: number[] }).coordinates) {
                coordinates = (this.profile_loc.value as { coordinates: number[] }).coordinates;
           } else {
                coordinates = [0, 0];
           }
        }

        // HAE = Height Above Ellipsoid (altitude), CE = Circular Error (accuracy)
        const hae = altitude !== null && altitude !== undefined ? altitude : 0;

        const uid = this.uid();

        const type = this.profile_type ? this.profile_type.value : undefined;
        const callsign = this.profile_callsign ? this.profile_callsign.value : undefined;
        const remarks = this.profile_remarks ? this.profile_remarks.value : undefined;
        const group = this.profile_group ? this.profile_group.value : undefined;
        const role = this.profile_role ? this.profile_role.value : undefined;

        const feat: Feature = {
            id: uid,
            path: '/',
            type: 'Feature',
            properties: {
                id: uid,
                type: type as string,
                how: 'm-g',
                callsign: callsign as string,
                remarks: remarks as string,
                droid: callsign as string,
                time: new Date().toISOString(),
                start: new Date().toISOString(),
                stale: new Date(new Date().getTime() + (1000 * 60)).toISOString(),
                center: coordinates,
                contact: { endpoint: '*:-1:stcp', callsign: callsign as string },
                group: {
                    name: group as string,
                    role: role as string
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

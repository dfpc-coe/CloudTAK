import { Static, Type } from '@sinclair/typebox'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { TAKRole, TAKGroup } from '@tak-ps/node-tak/lib/api/types'
import Config from '../config.js';
import { Profile } from '../schema.js';
import {
    toEnum, Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Text, Profile_Projection, Profile_Zoom,
} from '../enums.js'
import { ProfileResponse } from '../types.js';

export const ProfileConfigDefaults = {
    'display::stale': Profile_Stale.TenMinutes,
    'display::distance': Profile_Distance.MILE,
    'display::elevation': Profile_Elevation.FEET,
    'display::speed': Profile_Speed.MPH,
    'display::projection': Profile_Projection.GLOBE,
    'display::zoom': Profile_Zoom.CONDITIONAL,
    'display::text': Profile_Text.Medium,
    'display::icon_rotation': true,

    'menu::order': [],

    'tak::callsign': 'CloudTAK User',
    'tak::remarks': 'CloudTAK User',
    'tak::group': TAKGroup.ORANGE,
    'tak::type': 'a-f-G-E-V-C',
    'tak::role': TAKRole.TEAM_MEMBER,
    'tak::loc_freq': 2000,
    'tak::loc': null
}


export const DefaultUnits = Type.Object({
    'stale': Type.Object({
        value: Type.Enum(Profile_Stale, {
            default: ProfileConfigDefaults['display::stale']
        }),
        options: Type.Array(Type.String())
    }),
    'distance': Type.Object({
        value: Type.Enum(Profile_Distance, {
            default: ProfileConfigDefaults['display::distance']
        }),
        options: Type.Array(Type.String())
    }),
    'elevation': Type.Object({
        value: Type.Enum(Profile_Elevation, {
            default: ProfileConfigDefaults['display::elevation']
        }),
        options: Type.Array(Type.String())
    }),
    'speed': Type.Object({
        value: Type.Enum(Profile_Speed, {
            default: ProfileConfigDefaults['display::speed']
        }),
        options: Type.Array(Type.String())
    }),
    'projection': Type.Object({
        value: Type.Enum(Profile_Projection, {
            default: ProfileConfigDefaults['display::projection']
        }),
        options: Type.Array(Type.String())
    }),
    'zoom': Type.Object({
        value: Type.Enum(Profile_Zoom, {
            default: ProfileConfigDefaults['display::zoom']
        }),
        options: Type.Array(Type.String())
    }),
    'text': Type.Object({
        value: Type.Enum(Profile_Text, {
            default: ProfileConfigDefaults['display::text']
        }),
        options: Type.Array(Type.String())
    }),
    'icon_rotation': Type.Object({
        value: Type.Boolean({
            default: ProfileConfigDefaults['display::icon_rotation']
        }),
        options: Type.Array(Type.Boolean())
    }),
});

export default class ProfileControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async from(email: string): Promise<Static<typeof ProfileResponse>> {
        const profile = await this.config.models.Profile.from(email);
        const configs = await this.config.models.ProfileConfig.from(email);

        const full_config = {
            ...ProfileConfigDefaults,
            ...configs
        };

        for (const key of Object.keys(full_config)) {
            (profile as any)[key.replace('::', '_')] = full_config[key as keyof typeof full_config];
        }

        // @ts-expect-error Update Batch-Generic to specify actual geometry type (Point) instead of Geometry
        return {
            ...profile,
            active: this.config.wsClients.has(profile.username),
            agency_admin: profile.agency_admin || []
        };
    }

    async generate(
        input: InferInsertModel<typeof Profile>,
    ): Promise<InferSelectModel<typeof Profile>> {
        const profile = await this.config.models.Profile.generate(input);

        // Create a new ProfileConfig for each default setting
        const configs: Array<Promise<any>> = [];

        for (const [key, value] of Object.entries(ProfileConfigDefaults)) {
            configs.push(this.config.models.Setting.typed(key, value).then((setting) => {
                return this.config.models.ProfileConfig.commit(profile.username, {
                    [key]: setting.value
                })
            }));
        }

        await Promise.all(configs);

        return profile;
    }

    async defaultUnits(): Promise<Static<typeof DefaultUnits>> {
        const keys = [
            'display::stale',
            'display::distance',
            'display::elevation',
            'display::speed',
            'display::projection',
            'display::zoom',
            'display::text',
            'display::icon_rotation',
        ];

        const final: Record<string, string> = {};
        (await Promise.allSettled(keys.map((key) => {
            return this.config.models.Setting.from(key);
        }))).forEach((k) => {
            if (k.status === 'rejected') return;
            return final[k.value.key.replace('display::', '')] = String(k.value.value);
        });

        for (let display of keys) {
            display = display.replace('display::', '')
        }

        return {
            stale: {
                value: toEnum.fromString(Type.Enum(Profile_Stale), final.stale || Profile_Stale.TenMinutes),
                options: Object.values(Profile_Stale)
            },
            distance: {
                value: toEnum.fromString(Type.Enum(Profile_Distance), final.distance || Profile_Distance.MILE),
                options: Object.values(Profile_Distance)
            },
            elevation: {
                value: toEnum.fromString(Type.Enum(Profile_Elevation), final.elevation || Profile_Elevation.FEET),
                options: Object.values(Profile_Elevation)
            },
            speed: {
                value: toEnum.fromString(Type.Enum(Profile_Speed), final.speed || Profile_Speed.MPH),
                options: Object.values(Profile_Speed)
            },
            projection: {
                value: toEnum.fromString(Type.Enum(Profile_Projection), final.projection || Profile_Projection.GLOBE),
                options: Object.values(Profile_Projection)
            },
            zoom: {
                value: toEnum.fromString(Type.Enum(Profile_Zoom), final.zoom || Profile_Zoom.CONDITIONAL),
                options: Object.values(Profile_Zoom)
            },
            text: {
                value: toEnum.fromString(Type.Enum(Profile_Text), final.text || Profile_Text.Medium),
                options: Object.values(Profile_Text)
            },
            icon_rotation: {
                value: final.icon_rotation === 'false' ? false : true,
                options: [true, false]
            }
        }
    }
}

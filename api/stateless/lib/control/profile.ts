import { Static, Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import { TAKRole, TAKGroup } from '@tak-ps/node-tak/lib/api/types';
import type ConfigStateless from '../../config.js';
import {
    toEnum, Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Text, Profile_Projection, Profile_Zoom, Profile_Style, Profile_Coordinate, Profile_Radiation_Dose,
} from '../../../common/enums.js';
import { ProfileResponse } from '../../../common/types.js';

export const ProfileConfigDefaults = {
    'display::stale': Profile_Stale.TenMinutes,
    'display::distance': Profile_Distance.MILE,
    'display::elevation': Profile_Elevation.FEET,
    'display::speed': Profile_Speed.MPH,
    'display::projection': Profile_Projection.GLOBE,
    'display::zoom': Profile_Zoom.CONDITIONAL,
    'display::style': Profile_Style.SYSTEM_DEFAULT,
    'display::coordinate': Profile_Coordinate.DD,
    'display::text': Profile_Text.Medium,
    'display::icon_rotation': true,
    'display::radiation_dose': Profile_Radiation_Dose.SIEVERTS,

    'geometry::point::type': 'u-d-p',
    'geometry::point::color': '#ff0000',
    'geometry::point::icon': '',

    'menu::order': [],

    'tak::phone': '',

    'tak::callsign': 'CloudTAK User',
    'tak::remarks': 'CloudTAK User',
    'tak::group': TAKGroup.ORANGE,
    'tak::type': 'a-f-G-E-V-C',
    'tak::role': TAKRole.TEAM_MEMBER,
    'tak::loc_freq': 2000,
    'tak::loc': null,
};

export const DefaultUnits = Type.Object({
    stale: Type.Object({
        value: Type.Enum(Profile_Stale, {
            default: ProfileConfigDefaults['display::stale'],
        }),
        options: Type.Array(Type.String()),
    }),
    distance: Type.Object({
        value: Type.Enum(Profile_Distance, {
            default: ProfileConfigDefaults['display::distance'],
        }),
        options: Type.Array(Type.String()),
    }),
    elevation: Type.Object({
        value: Type.Enum(Profile_Elevation, {
            default: ProfileConfigDefaults['display::elevation'],
        }),
        options: Type.Array(Type.String()),
    }),
    speed: Type.Object({
        value: Type.Enum(Profile_Speed, {
            default: ProfileConfigDefaults['display::speed'],
        }),
        options: Type.Array(Type.String()),
    }),
    projection: Type.Object({
        value: Type.Enum(Profile_Projection, {
            default: ProfileConfigDefaults['display::projection'],
        }),
        options: Type.Array(Type.String()),
    }),
    zoom: Type.Object({
        value: Type.Enum(Profile_Zoom, {
            default: ProfileConfigDefaults['display::zoom'],
        }),
        options: Type.Array(Type.String()),
    }),
    style: Type.Object({
        value: Type.Enum(Profile_Style, {
            default: ProfileConfigDefaults['display::style'],
        }),
        options: Type.Array(Type.String()),
    }),
    coordinate: Type.Object({
        value: Type.Enum(Profile_Coordinate, {
            default: ProfileConfigDefaults['display::coordinate'],
        }),
        options: Type.Array(Type.String()),
    }),
    text: Type.Object({
        value: Type.Enum(Profile_Text, {
            default: ProfileConfigDefaults['display::text'],
        }),
        options: Type.Array(Type.String()),
    }),
    icon_rotation: Type.Object({
        value: Type.Boolean({
            default: ProfileConfigDefaults['display::icon_rotation'],
        }),
        options: Type.Array(Type.Boolean()),
    }),
    radiation_dose: Type.Object({
        value: Type.Enum(Profile_Radiation_Dose, {
            default: ProfileConfigDefaults['display::radiation_dose'],
        }),
        options: Type.Array(Type.String()),
    }),
});

export default class ProfileControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    /**
     * Resolve Mission subscription options (name + token) for a user
     */
    async subscription(username: string, name: string): Promise<{
        name: string;
        token?: string;
    }> {
        const missions = await this.config.models.ProfileOverlay.list({
            where: sql`
                name = ${name}
                AND mode = 'mission'
                AND username = ${username}
            `,
        });

        if (missions.items.length === 0) {
            return { name };
        }

        return {
            name: missions.items[0].name,
            token: missions.items[0].token || undefined,
        };
    }

    async from(email: string): Promise<Static<typeof ProfileResponse>> {
        const profile = await this.config.models.Profile.from(email);
        const configs = await this.config.models.ProfileConfig.from(email);

        const full_config = {
            ...ProfileConfigDefaults,
            ...configs,
        };

        for (const key of Object.keys(full_config)) {
            (profile as any)[key.replace(/::/g, '_')] = full_config[key as keyof typeof full_config];
        }

        const presence = await this.config.hub.wsPresence([profile.username]);

        // @ts-expect-error Update Batch-Generic to specify actual geometry type (Point) instead of Geometry
        return {
            ...profile,
            active: presence[profile.username].active,
            agency_admin: profile.agency_admin || [],
        };
    }

    async defaultUnits(): Promise<Static<typeof DefaultUnits>> {
        const keys = [
            'display::stale',
            'display::distance',
            'display::elevation',
            'display::speed',
            'display::projection',
            'display::zoom',
            'display::style',
            'display::coordinate',
            'display::text',
            'display::icon_rotation',
            'display::radiation_dose',
        ];

        const final: Record<string, string> = {};
        (await Promise.allSettled(keys.map((key) => {
            return this.config.models.Setting.from(key);
        }))).forEach((k) => {
            if (k.status === 'rejected') return;
            return final[k.value.key.replace('display::', '')] = String(k.value.value);
        });

        return {
            stale: {
                value: toEnum.fromString(Type.Enum(Profile_Stale), final.stale || Profile_Stale.TenMinutes),
                options: Object.values(Profile_Stale),
            },
            distance: {
                value: toEnum.fromString(Type.Enum(Profile_Distance), final.distance || Profile_Distance.MILE),
                options: Object.values(Profile_Distance),
            },
            elevation: {
                value: toEnum.fromString(Type.Enum(Profile_Elevation), final.elevation || Profile_Elevation.FEET),
                options: Object.values(Profile_Elevation),
            },
            speed: {
                value: toEnum.fromString(Type.Enum(Profile_Speed), final.speed || Profile_Speed.MPH),
                options: Object.values(Profile_Speed),
            },
            projection: {
                value: toEnum.fromString(Type.Enum(Profile_Projection), final.projection || Profile_Projection.GLOBE),
                options: Object.values(Profile_Projection),
            },
            zoom: {
                value: toEnum.fromString(Type.Enum(Profile_Zoom), final.zoom || Profile_Zoom.CONDITIONAL),
                options: Object.values(Profile_Zoom),
            },
            style: {
                value: toEnum.fromString(Type.Enum(Profile_Style), final.style || Profile_Style.SYSTEM_DEFAULT),
                options: Object.values(Profile_Style),
            },
            coordinate: {
                value: toEnum.fromString(Type.Enum(Profile_Coordinate), final.coordinate || Profile_Coordinate.DD),
                options: Object.values(Profile_Coordinate),
            },
            text: {
                value: toEnum.fromString(Type.Enum(Profile_Text), final.text || Profile_Text.Medium),
                options: Object.values(Profile_Text),
            },
            icon_rotation: {
                value: final.icon_rotation === 'false' ? false : true,
                options: [true, false],
            },
            radiation_dose: {
                value: toEnum.fromString(Type.Enum(Profile_Radiation_Dose), final.radiation_dose || Profile_Radiation_Dose.SIEVERTS),
                options: Object.values(Profile_Radiation_Dose),
            },
        };
    }
}

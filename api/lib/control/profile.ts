import { Static, Type } from '@sinclair/typebox'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import Config from '../config.js';
import { Profile } from '../schema.js';
import {
    toEnum, Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Text, Profile_Projection, Profile_Zoom,
} from '../enums.js'

export const DefaultUnits = Type.Object({
    'stale': Type.Object({
        value: Type.Enum(Profile_Stale, {
            default: Profile_Stale.TenMinutes
        }),
        options: Type.Array(Type.String())
    }),
    'distance': Type.Object({
        value: Type.Enum(Profile_Distance, {
            default: Profile_Distance.MILE
        }),
        options: Type.Array(Type.String())
    }),
    'elevation': Type.Object({
        value: Type.Enum(Profile_Elevation, {
            default: Profile_Elevation.FEET
        }),
        options: Type.Array(Type.String())
    }),
    'speed': Type.Object({
        value: Type.Enum(Profile_Speed, {
            default: Profile_Speed.MPH
        }),
        options: Type.Array(Type.String())
    }),
    'projection': Type.Object({
        value: Type.Enum(Profile_Projection, {
            default: Profile_Projection.GLOBE
        }),
        options: Type.Array(Type.String())
    }),
    'zoom': Type.Object({
        value: Type.Enum(Profile_Zoom, {
            default: Profile_Zoom.CONDITIONAL
        }),
        options: Type.Array(Type.String())
    }),
    'text': Type.Object({
        value: Type.Enum(Profile_Text, {
            default: Profile_Text.Medium
        }),
        options: Type.Array(Type.String())
    }),
    'icon_rotation': Type.Object({
        value: Type.String({
            default: 'Enabled'
        }),
        options: Type.Array(Type.String())
    }),
});

export default class ProfileControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async generate(
        input: InferInsertModel<typeof Profile>,
    ): Promise<InferSelectModel<typeof Profile>> {
        const defaults = await this.defaultUnits();

        if (!input.display_stale) input.display_stale = defaults.stale.value;
        if (!input.display_distance) input.display_distance = defaults.distance.value;
        if (!input.display_elevation) input.display_elevation = defaults.elevation.value;
        if (!input.display_speed) input.display_speed = defaults.speed.value;
        if (!input.display_projection) input.display_projection = defaults.projection.value;
        if (!input.display_zoom) input.display_zoom = defaults.zoom.value;
        if (!input.display_text) input.display_text = defaults.text.value;
        if (input.display_icon_rotation === undefined) input.display_icon_rotation = true;

        const profile = await this.config.models.Profile.generate(input);

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
                value: final.icon_rotation || 'Enabled',
                options: ['Enabled', 'Disabled']
            }
        }
    }
}

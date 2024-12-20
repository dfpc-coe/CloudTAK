import Err from '@openaddresses/batch-error';
import { Static, TSchema, TUnknown } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

export class toEnum {
    static fromString<T extends TSchema>(type: T, str: string): Static<T>;

    static fromString<T extends TSchema = TUnknown>(type: T, str: string): Static<T> {
        const typeChecker = TypeCompiler.Compile(type)
        const result = typeChecker.Check(str);

        if (result) return str;

        const errors = typeChecker.Errors(str);
        const firstError = errors.First();

        throw new Err(500, null, `Internal Validation Error: ${JSON.stringify(firstError)}`);
    }
}

export enum Profile_Projection {
    MERCATOR = 'mercator',
    GLOBE = 'GLOBE',
}

export enum Basemap_Format {
    PNG = 'png',
    JPEG = 'jpeg',
    MVT = 'mvt'
}

export enum Basemap_Style {
    ZXY = 'zxy'
}

export enum Basemap_Type {
    RASTER = 'raster',
    TERRAIN = 'raster-dem',
    VECTOR = 'vector',
}

export enum Layer_Priority {
    HIGH = 'high',
    LOW = 'low',
    OFF = 'off'
}

export enum Profile_Text {
    Small = 'Small',
    Medium = 'Medium',
    Large = 'Large'
}

export enum Profile_Stale {
    Immediate = 'Immediate',
    TenMinutes = '10 Minutes',
    ThirtyMinutes = '30 Minutes',
    OneHour = '1 Hour',
    Never = 'Never'
}

export enum Profile_Speed {
    MS = 'm/s',
    KMH = 'km/h',
    MPH = 'mi/h'
}

export enum Profile_Distance {
    METER = 'meter',
    KILOMETER = 'kilometer',
    MILE = 'mile'
}

export enum Profile_Elevation {
    METER = 'meter',
    FEET = 'feet'
}

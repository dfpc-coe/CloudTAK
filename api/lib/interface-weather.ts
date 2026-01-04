import { Static, Type } from "@sinclair/typebox";
import NOAA from './weather/noaa.js';
import OpenMeteo from './weather/open-meteo.js';

export const FetchHourly = Type.Object({
    type: Type.String(),
    properties: Type.Object({
        units: Type.String(),
        forecastGenerator: Type.String(),
        generatedAt: Type.String(),
        updateTime: Type.String(),
        validTimes: Type.String(),
        elevation: Type.Object({
            unitCode: Type.String(),
            value: Type.Number()
        }),
        periods: Type.Array(Type.Object({
            number: Type.Integer(),
            name: Type.String(),
            startTime: Type.String(),
            endTime: Type.String(),
            isDaytime: Type.Boolean(),
            temperature: Type.Integer(),
            temperatureUnit: Type.String(),
            temperatureTrend: Type.Unknown(),
            probabilityOfPrecipitation: Type.Object({
                unitCode: Type.String(),
                value: Type.Number()
            }),
            dewpoint: Type.Object({
                unitCode: Type.String(),
                value: Type.Number()
            }),
            relativeHumidity: Type.Object({
                unitCode: Type.String(),
                value: Type.Number()
            }),
            windSpeed: Type.String(),
            windDirection: Type.String(),
            icon: Type.String(),
            shortForecast: Type.String(),
            detailedForecast: Type.String(),
        }))
    }),
    geometry: Type.Object({
        type: Type.String(),
        coordinates: Type.Array(Type.Array(Type.Array(Type.Number())))
    })
});

export const FetchType = Type.Object({
    id: Type.String(),
    type: Type.String(),
    properties: Type.Object({
        cwa: Type.String(),
        gridId: Type.String(),
        gridX: Type.Integer(),
        gridY: Type.Integer(),
        forecast: Type.String(),
        forecastOffice: Type.String(),
        forecastHourly: Type.String(),
        forecastGridData: Type.String(),
        observationStations: Type.String(),
        relativeLocation: Type.Object({
            type: Type.String(),
            geometry: Type.Object({
                type: Type.String(),
                coordinates: Type.Array(Type.Number())
            }),
            properties: Type.Object({
                city: Type.String(),
                state: Type.String(),
                distance: Type.Object({
                    unitCode: Type.String(),
                    value: Type.Number()
                }),
                bearing: Type.Object({
                    unitCode: Type.String(),
                    value: Type.Number()
                })
            })
        }),
        forecastZone: Type.String(),
        county: Type.String(),
        fireWeatherZone: Type.String(),
        timeZone: Type.String(),
        radarStation: Type.String()
    }),
    geometry: Type.Object({
        type: Type.String(),
        coordinates: Type.Array(Type.Number())
    })
});

export interface WeatherInterface {
    get(lon: number, lat: number): Promise<Static<typeof FetchHourly>>;
}

export class WeatherManager {
    services: Map<string, WeatherInterface>;

    constructor() {
        this.services = new Map();
        this.services.set('noaa', new NOAA());
        this.services.set('open-meteo', new OpenMeteo());
    }

    async get(lon: number, lat: number): Promise<Static<typeof FetchHourly>> {
        try {
            const noaa = this.services.get('noaa');
            if (!noaa) throw new Error('NOAA Service not found');
            return await noaa.get(lon, lat);
        } catch {
            const om = this.services.get('open-meteo');
            if (!om) throw new Error('OpenMeteo Service not found');
            return await om.get(lon, lat);
        }
    }
}

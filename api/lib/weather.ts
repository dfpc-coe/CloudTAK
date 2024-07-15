import fetch from './fetch.js';
import { Static, Type } from "@sinclair/typebox";

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

export default class Weather {
    api: string;
    user: string;

    constructor() {
        this.api = 'https://api.weather.gov'
        this.user = `(cotak.gov, nicholas.ingalls@state.co.us)`
    }

    async get(lon: number, lat: number): Promise<Static<typeof FetchHourly>> {
        const feat = await this.fetch(lon, lat);

        const hourly = await this.fetch_hourly(feat.properties.forecastHourly);

        return hourly;
    }

    async fetch(lon: number, lat: number): Promise<Static<typeof FetchType>> {
        const res = await fetch(new URL(`/points/${encodeURIComponent(lat)},${encodeURIComponent(lon)}`, this.api), {
            method: 'GET',
            headers: {
                'User-Agent': this.user
            }
        })

        const body = await res.typed(FetchType);

        return body;
    }

    async fetch_hourly(url: string): Promise<Static<typeof FetchHourly>> {
        const res = await fetch(new URL(url), {
            method: 'GET',
            headers: {
                'User-Agent': this.user
            }
        });

        const body = await res.typed(FetchHourly);

        return body;
    }
}

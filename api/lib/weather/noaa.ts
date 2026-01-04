import fetch from '../fetch.js';
import { Static } from "@sinclair/typebox";
import { WeatherInterface, FetchHourly, FetchType } from '../interface-weather.js';

export default class NOAA implements WeatherInterface {
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
        });

        if (!res.ok) {
            throw new Error(`NWS API failed: ${res.status}`);
        }

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

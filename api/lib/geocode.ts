import fetch from './fetch.js';
import Err from '@openaddresses/batch-error';
import Config from './config.js';
import { Static, Type } from "@sinclair/typebox";

export const FetchReverse = Type.Object({
    LongLabel: Type.String(),
    ShortLabel: Type.String(),
    Addr_type: Type.String(),
});

const ReverseContainer = Type.Object({
    address: FetchReverse
});

export const FetchForward = Type.Object({
});

export default class Geocode {
    reverseApi: string;
    token?: string;

    constructor(token?: string) {
        this.reverseApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
        this.token = token;
    }

    async reverse(lon: number, lat: number): Promise<Static<typeof FetchReverse>> {
        const url = new URL(this.reverseApi)
        url.searchParams.append('location', `${lon},${lat}`);
        url.searchParams.append('f', 'json');

        const res = await fetch(url);

        const body = await res.typed(ReverseContainer)

        return body.address;
    }

    async forward(search: string): Promise<Static<typeof FetchForward>> {
        throw new Err(400, null, 'Unimplemented');
    }
}

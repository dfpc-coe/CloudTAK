import fetch from './fetch.js';
import { Static, Type } from "@sinclair/typebox";

export const FetchReverse = Type.Object({
    LongLabel: Type.String(),
    ShortLabel: Type.String(),
    Addr_type: Type.String(),
});

const ReverseContainer = Type.Object({
    address: FetchReverse
});


export const FetchSuggest = Type.Object({
    text: Type.String(),
    magicKey: Type.String(),
    isCollection: Type.Boolean()
});

export const SuggestContainer = Type.Object({
    suggestions: Type.Array(FetchSuggest)
})

export const FetchForward = Type.Object({
    address: Type.String(),
    location: Type.Object({
        x: Type.Number(),
        y: Type.Number(),
    }),
    score: Type.Integer(),
    attributes: Type.Object({
        LongLabel: Type.Optional(Type.String()),
        ShortLabel: Type.Optional(Type.String()),
    }),
    extent: Type.Object({
        xmin: Type.Number(),
        ymin: Type.Number(),
        xmax: Type.Number(),
        ymax: Type.Number()
    })
});

export const ForwardContainer = Type.Object({
    candidates: Type.Array(FetchForward)
})

export default class Geocode {
    reverseApi: string;
    suggestApi: string;
    forwardApi: string;
    token?: string;

    constructor(token?: string) {
        this.reverseApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
        this.suggestApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';
        this.forwardApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates'
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

    async forward(query: string, magicKey: string, limit?: number): Promise<Array<Static<typeof FetchForward>>> {
        const url = new URL(this.forwardApi)
        url.searchParams.append('magicKey', magicKey);
        url.searchParams.append('singleLine', query);
        if (limit) url.searchParams.append('maxLocations', String(limit));
        if (this.token) url.searchParams.append('token', this.token);
        url.searchParams.append('f', 'json');

        const res = await fetch(url);

        const body = await res.typed(ForwardContainer)

        return body.candidates;
    }

    async suggest(query: string, limit?: number): Promise<Array<Static<typeof FetchSuggest>>> {
        const url = new URL(this.suggestApi)
        url.searchParams.append('text', query);
        url.searchParams.append('f', 'json');
        if (limit) url.searchParams.append('maxSuggestions', String(limit));

        const res = await fetch(url);

        const body = await res.typed(SuggestContainer)

        return body.suggestions;
    }
}

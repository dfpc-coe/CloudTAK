import TAKAPI from '../tak-api.js';
import xmljs from 'xml-js';
import { CoT } from '@tak-ps/node-tak';
import { Type, Static } from '@sinclair/typebox';
import type { Feature } from '@tak-ps/node-cot';

export const HistoryOptions = Type.Object({
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String()),
    secago: Type.Optional(Type.String()),
})

export default class COTQuery {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async historyFeats(uid: string, opts?: Static<typeof HistoryOptions>): Promise<Array<Static<typeof Feature.Feature>>> {
        const feats: Static<typeof Feature.Feature>[] = [];

        const res: any = xmljs.xml2js(await this.history(uid, opts), { compact: true });

        if (!Object.keys(res.events).length) return feats;
        if (!res.events.event || (Array.isArray(res.events.event) && !res.events.event.length)) return feats;

        for (const event of Array.isArray(res.events.event) ? res.events.event : [res.events.event] ) {
            feats.push((new CoT({ event })).to_geojson());
        } 

        return feats;
    }

    async history(uid: string, opts?: Static<typeof HistoryOptions>): Promise<string> {
        const url = new URL(`/Marti/api/cot/xml/${encodeURIComponent(uid)}/all`, this.api.url);

        if (opts) {
            let q: keyof Static<typeof HistoryOptions>;
            for (q in opts) {
                if (opts[q] !== undefined) {
                    url.searchParams.append(q, String(opts[q]));
                }
            }
        }

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        const body = await res.text();

        return body;
    }
}

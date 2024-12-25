import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';
import { Group } from './groups.js';
import { TAKList } from './types.js';

export const Subscription = Type.Object({
    dn: Type.Union([Type.String(), Type.Null()]),
    callsign: Type.String(),
    clientUid: Type.String(),
    lastReportMilliseconds: Type.Integer(),
    takClient: Type.String(),
    takVersion: Type.String(),
    username: Type.String(),
    groups: Type.Array(Group),
    role: Type.String(),
    team: Type.String(),
    ipAddress: Type.String(),
    port: Type.String(),
    pendingWrites: Type.Integer(),
    numProcessed: Type.Integer(),
    protocol: Type.String(),
    xpath: Type.Union([Type.String(), Type.Null()]),
    subscriptionUid: Type.String(),
    appFramerate: Type.String(),
    battery: Type.String(),
    batteryStatus: Type.String(),
    batteryTemp: Type.String(),
    deviceDataRx: Type.String(),
    deviceDataTx: Type.String(),
    heapCurrentSize: Type.String(),
    heapFreeSize: Type.String(),
    heapMaxSize: Type.String(),
    deviceIPAddress: Type.String(),
    storageAvailable: Type.String(),
    storageTotal: Type.String(),
    incognito: Type.Boolean(),
    handlerType: Type.String(),
    lastReportDiffMilliseconds: Type.Integer()
});

export const ListSubscriptionInput = Type.Object({
    sortBy: Type.String({
        default: 'CALLSIGN',
        enum: ['CALLSIGN', 'UID']
    }),
    direction: Type.String({
        default: 'ASCENDING',
        enum: ['ASCENDING', 'DESCENDING']
    }),
    page: Type.Integer({
        default: -1
    }),
    limit: Type.Integer({
        default: -1
    })
})

export const TAKList_Subscription = TAKList(Subscription);


export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(
        query: Static<typeof ListSubscriptionInput>
    ): Promise<Static<typeof TAKList_Subscription>> {
        const url = new URL(`/Marti/api/subscriptions/all`, this.api.url);

        let q: keyof Static<typeof ListSubscriptionInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}

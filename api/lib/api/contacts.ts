import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';

export const Contact = Type.Object({
    filterGroups: Type.Any(), // I'm not familiar with this one
    notes: Type.String(),
    callsign: Type.String(),
    team: Type.String(),
    role: Type.String(),
    takv: Type.String(),
    uid: Type.String()
});

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(): Promise<Array<Static<typeof Contact>>> {
        const url = new URL(`/Marti/api/contacts/all`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}

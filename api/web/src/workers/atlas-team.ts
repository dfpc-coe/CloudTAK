import type Atlas from './atlas.ts';
import { std, stdurl } from '../std.ts';
import type { ContactList, Contact } from '../types.ts';

export default class AtlasTeam {
    atlas: Atlas;
    contacts: Map<string, Contact>

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.contacts = new Map();
    }

    async init(): Promise<void> {
        await Promise.all([ this.load() ])
    }

    async load() {
        const url = stdurl('/api/marti/api/contacts/all');
        const contacts = await std(url, {
            token: this.atlas.token
        }) as ContactList;

        for (const contact of contacts) {
            if (!contact.uid) continue;
            this.contacts.set(contact.uid, contact);
        }
    }
}

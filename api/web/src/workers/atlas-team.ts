import type Atlas from './atlas.ts';
import { std, stdurl } from '../std.ts';
import type COT from '../base/cot.ts';
import { WorkerMessageType } from '../base/events.ts';
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

    async set(cot: COT): Promise<Contact> {
        if (!cot.properties.group) {
            throw new Error('Contact Marker must have group property');
        }

        const entry = this.contacts.get(cot.id);

        if (entry) {
            return entry;
        } else {
            const contact: Contact = {
                uid: cot.id,
                notes: '',
                filterGroups: null,
                callsign: cot.properties.callsign,
                team: cot.properties.group.name,
                role: cot.properties.group.role,
                takv: ''
            }

            this.contacts.set(cot.id, contact);

            // Only trigger Contact_Change for truly new contacts, not self
            if (this.atlas.profile.uid() !== cot.id) {
                this.atlas.postMessage({
                    type: WorkerMessageType.Contact_Change
                });
            }

            return contact;
        }
    }

    async get(uid: string): Promise<Contact | undefined> {
        return this.contacts.get(uid);
    }

    async load(): Promise<Contact[]> {
        try {
            const url = stdurl('/api/marti/api/contacts/all');
            const contacts = await std(url, {
                token: this.atlas.token
            }) as ContactList;

            this.contacts.clear();

            for (const contact of contacts) {
                if (!contact.uid) continue;
                this.contacts.set(contact.uid, contact);
            }
        } catch (err) {
            console.warn('Failed to load contacts from TAK server:', err);
            // Continue with empty contacts list rather than failing completely
        }

        return Array.from(this.contacts.values());
    }
}

import type Atlas from './atlas.ts';
import type COT from '../base/cot.ts';
import ContactManager from '../base/contact.ts';
import TAKNotification, { NotificationType } from '../base/notification.ts';
import {
    WorkerMessageType
} from '../base/events.ts';

import type { Contact } from '../types.ts';

export default class AtlasTeam {
    atlas: Atlas;

    constructor(atlas: Atlas) {
        this.atlas = atlas;
    }

    async init(): Promise<void> {
        await Promise.all([ this.load() ])
    }

    async set(cot: COT): Promise<Contact> {
        if (!cot.properties.group) {
            throw new Error('Contact Marker must have group property');
        }

        const entry = await ContactManager.get(cot.id);

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

            await ContactManager.put(contact);

            this.atlas.postMessage({
                type: WorkerMessageType.Contact_Change
            });

            if (this.atlas.profile.uid() !== cot.id) {
                await TAKNotification.create(
                    NotificationType.Contact,
                    'Online Contact',
                    `${cot.properties.callsign} is now Online`,
                    `/cot/${cot.id}`,
                    false
                );
            }

            return contact;
        }
    }

    async get(uid: string): Promise<Contact | undefined> {
        return await ContactManager.get(uid);
    }

    async getByCallsign(callsign: string): Promise<Contact | undefined> {
        const contacts = await ContactManager.list({ filter: callsign });
        return contacts.find(c => c.callsign === callsign);
    }

    async list(): Promise<Contact[]> {
        return await ContactManager.list();
    }

    async load(): Promise<Contact[]> {
        return await ContactManager.sync(this.atlas.token);
    }
}

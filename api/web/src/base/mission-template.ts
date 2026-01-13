import { db } from './database.ts'
import type { DBMissionTemplate } from './database.ts';
import { std, stdurl } from '../std.ts';
import MissionTemplateLogs from './mission-template-logs.ts';
import type {
    MissionTemplate as APIMissionTemplate,
    MissionTemplateList
} from '../types.ts';

export default class MissionTemplate {
    id: string;
    logs: MissionTemplateLogs;

    // Local cached props
    name: string;
    description: string;
    icon: string;
    created: string;
    updated: string;

    constructor(
        template: DBMissionTemplate
    ) {
        this.id = template.id;
        this.name = template.name;
        this.description = template.description;
        this.icon = template.icon;
        this.created = template.created;
        this.updated = template.updated;

        this.logs = new MissionTemplateLogs(this.id);
    }

    static async from(
         id: string,
    ): Promise<MissionTemplate | undefined> {
        const exists = await db.mission_template.get(id);

        if (!exists) {
            return;
        }

        return new MissionTemplate(exists);
    }

    static async load(
        id: string,
        opts: {
            refresh?: boolean,
        } = {}
    ): Promise<MissionTemplate> {
        const exists = await this.from(id);

        if (exists) {
            if (opts.refresh) {
                 await exists.refresh();
            }
            return exists;
        }

        const stub: DBMissionTemplate = {
            id: id,
            name: '',
            icon: '',
            description: '',
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
        
        await db.mission_template.put(stub);
        const templ = new MissionTemplate(stub);
        await templ.refresh();
        return templ;
    }

    async refresh(): Promise<void> {
        const url = stdurl(`/api/template/mission/${this.id}`);
        const data = await std(url) as APIMissionTemplate;
        
        const update: DBMissionTemplate = {
            id: data.id,
            name: data.name,
            icon: data.icon,
            description: data.description,
            created: data.created,
            updated: data.updated
        };
        
        await db.mission_template.put(update);
        
        this.name = update.name;
        this.description = update.description;
        this.icon = update.icon;
        this.created = update.created;
        this.updated = update.updated;

        if (data.logs) {
             await db.transaction('rw', db.mission_template_log, async () => {
                await db.mission_template_log
                    .where('template')
                    .equals(this.id)
                    .delete();

                for (const log of data.logs) {
                    await db.mission_template_log.put({
                        id: log.id,
                        template: this.id,
                        name: log.name,
                        icon: log.icon,
                        description: log.description,
                        created: log.created,
                        updated: log.updated,
                        schema: log.schema
                    });
                }
            });
        }
    }

    static async list(filter?: string): Promise<DBMissionTemplate[]> {
        let collection = db.mission_template.toCollection();

        if (filter) {
            collection = collection.filter((templ) => {
                return templ.name.toLowerCase().includes(filter.toLowerCase());
            });
        }

        return (await collection.sortBy('name'));
    }

    static async sync(): Promise<MissionTemplateList> {
        const url = stdurl('/api/template/mission');

        const list = await std(url) as MissionTemplateList;

        const serverIds = new Set(list.items.map(c => c.id));
        const local = await db.mission_template.toArray();

        for (const templ of local) {
            if (!serverIds.has(templ.id)) {
                await db.mission_template.delete(templ.id);
                // Also delete logs
                await db.mission_template_log.where('template').equals(templ.id).delete();
            }
        }

        for (const templ of list.items) {
            const exists = await db.mission_template.get(templ.id);
            if (!exists) {
                await db.mission_template.put({
                    id: templ.id,
                    name: templ.name,
                    icon: templ.icon,
                    description: templ.description,
                    created: templ.created,
                    updated: templ.updated
                });
            } else {
                 await db.mission_template.update(templ.id, {
                    name: templ.name,
                    icon: templ.icon,
                    description: templ.description,
                    updated: templ.updated
                 });
            }
        }

        return list;
    }
}

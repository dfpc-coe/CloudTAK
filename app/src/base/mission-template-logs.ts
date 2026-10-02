import { db } from '../database.ts';
import { server } from '../std.ts';
import type {
    MissionTemplateLogList
} from '../types.ts'
import type { DBMissionTemplateLog } from '../database.ts';

export default class MissionTemplateLogs {
    template: string;

    constructor(
        template: string
    ) {
        this.template = template;
    }

    async refresh(): Promise<void> {
        const res = await server.GET('/api/template/mission/{:mission}/log', {
            params: {
                path: { ':mission': this.template },
                query: { limit: 100, page: 0, order: 'asc', sort: 'name', filter: '' }
            }
        });

        if (res.error) throw new Error(res.error.message);

        const list: MissionTemplateLogList = res.data;

        await db.transaction('rw', db.mission_template_log, async () => {
            await db.mission_template_log
                .where('template')
                .equals(this.template)
                .delete();

            for (const log of list.items) {
                await db.mission_template_log.put({
                    id: log.id,
                    template: this.template,
                    name: log.name,
                    icon: log.icon,
                    description: log.description,
                    created: log.created,
                    updated: log.updated,
                    schema: log.schema,
                    keywords: log.keywords || []
                });
            }
        });
    }

    async list(
        opts?: {
            refresh?: boolean,
        }
    ): Promise<Array<DBMissionTemplateLog>> {
        if (opts?.refresh) {
            await this.refresh();
        }

        return await db.mission_template_log.where('template').equals(this.template).toArray();
    }
}

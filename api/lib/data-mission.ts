import { Data } from './schema.js';
import { Static } from '@sinclair/typebox';
import { InferSelectModel } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from './tak-api.js';
import Config from './config.js';
import { Mission } from './api/mission.js';

export default class DataMission {
    static async sync(config: Config, data: InferSelectModel<typeof Data>): Promise<Static<typeof Mission> | void> {
        const connection = await config.models.Connection.from(data.connection);

        const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

        // All groups should be active for data-sync api to work properly
        const groups = await api.Group.list({ useCache: 'true' });
        if (groups.data.some((g) => { return !g.active })) {
            await api.Group.update(groups.data.map((group) => {
                group.active = true;
                return group;
            }), {})
        }

        let mission;

        try {
            mission = await api.Mission.get(data.name, {}, {
                token: data.mission_token
            });
            //TODO Update Groups: Not supported by TAK Server at this time

            if (!data.mission_sync) {
                await api.Mission.delete(data.name, {}, {
                    token: data.mission_token
                });
                return;
            }
        } catch (err) {
            if (!data.mission_sync) return;

            if (!data.mission_groups.length) {
                data.mission_groups = groups.data.map((group) => { return group.name });
            }

            const missions = await api.Mission.create(data.name, {
                creatorUid: `connection-${data.connection}-data-${data.id}`,
                description: data.description,
                defaultRole: data.mission_role,
                group: data.mission_groups,
            });

            if (!missions.data.length) throw new Error('Create Mission didn\'t return a mission or an error');
            mission = missions.data[0];

            await config.models.Data.commit(data.id, {
                mission_token: mission.token
            });

        }

        return mission;
    }
}

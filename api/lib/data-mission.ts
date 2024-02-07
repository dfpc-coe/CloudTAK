import { Data } from './schema.js';
import { InferSelectModel } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from './tak-api.js';
import Config from './config.js';
import { Mission } from './api/mission.js';

export default class DataMission {
    static async sync(config: Config, data: InferSelectModel<typeof Data>): Promise<Mission> {

        const connection = await config.models.Connection.from(data.connection);

        const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

        try {
            const missions = await api.Mission.get(data.name, {});
            //TODO Update Groups: Not supported by TAK Server at this time

            if (!data.mission_sync) {
                await api.Mission.delete(data.name, {});
            }

            if (!missions.data.length) throw new Error('Create Mission didn\'t return a mission or an error');
            return missions.data[0];
        } catch (err) {
            if (!data.mission_sync) return;

            if (!data.mission_groups.length) {
                data.mission_groups = (await api.Group.list({
                    useCache: 'true'
                })).data.map((group) =>{
                    return group.name;
                });
            }

            const missions = await api.Mission.create(data.name, {
                creatorUid: `connection-${data.connection}-data-${data.id}`,
                description: data.description,
                group: data.mission_groups
            });

            if (!missions.data.length) throw new Error('Create Mission didn\'t return a mission or an error');
            return missions.data[0];
        }
    }
}

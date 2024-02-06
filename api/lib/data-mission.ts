import { Data } from './schema.js';
import { InferSelectModel } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from './tak-api.js';
import Config from './config.js';

export default class DataMission {
    static async sync(config: Config, data: InferSelectModel<typeof Data>): Promise<void> {

        const connection = await config.models.Connection.from(data.connection);

        const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

        let mission;
        try {
            await api.Mission.get(data.name, {});
            //TODO Update Groups: Not supported by TAK Server at this time

            if (!data.mission_sync) {
                await api.Mission.delete(data.name, {});
            }
        } catch (err) {
            if (!data.mission_sync) return;

            if (!data.mission_groups.length) {
                data.mission_groups = (await api.Group.list({
                    useCache: 'true'
                })).data.map((group) =>{
                    return group.name;
                });
            }

            await api.Mission.create(data.name, {
                creatorUid: `connection-${data.connection}-data-${data.id}`,
                description: data.description,
                group: data.mission_groups
            });
        }
    }
}

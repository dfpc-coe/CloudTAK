import { Data } from './schema.js';
import { InferSelectModel } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from './tak-api.js';
import Config from './config.js';

export default class DataMission {
    static async sync(config: Config, data: InferSelectModel<typeof Data>): Promise<void> {
        // Right now we don't delete the mission if sync is turned off
        if (!data.mission_sync) return;

        const connection = await config.models.Connection.from(data.connection);

        const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

        let mission;
        try {
            mission = await api.Mission.get(data.name, {});
            //TODO Compare groups and update as necessary
        } catch (err) {
            const groups = await api.Group.list({});

            mission = await api.Mission.create(data.name, {
                creatorUid: `connection-${data.connection}-data-${data.id}`,
                group: groups.data.map((group) => {
                    return group.name;
                })
            });
        }

        console.error(JSON.stringify(mission));
    }
}

import { Data } from './schema.js';
import { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import { InferSelectModel } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from './tak-api.js';
import { MissionLayer, MissionLayerType } from './api/mission-layer.js';
import Config from './config.js';
import { Mission } from './api/mission.js';

export const MAX_LAYERS_IN_DATA_SYNC = 1;

export default class DataMission {
    /**
     * Return a TAK Mission Response if the given mission exists,
     * or attempt to create the mission if it doesn't
     */
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

        const layers = await config.models.Layer.list({
            limit: MAX_LAYERS_IN_DATA_SYNC,
            where: sql`data = ${data.id}`
        });

        const existMap: Map<string, Static<typeof MissionLayer>> = new Map();
        for (const l of (await api.MissionLayer.list(
            data.name,
            { token: data.mission_token }
        )).data) existMap.set(l.uid, l);

        for (const l of layers.items) {
            const exists = existMap.get(`layer-${l.id}`);
            if (!exists) {
                await api.MissionLayer.create(
                    data.name,
                    {
                        uid: `layer-${l.id}`,
                        name: l.name,
                        type: MissionLayerType.GROUP,
                        creatorUid: `connection-${data.connection}-data-${data.id}`
                    },
                    { token: data.mission_token }
                );
            } else {
                // Check for Layer Type Mismatch - not sure
                // Check for Name Mismatch - rename
            }
        }

        return mission;
    }
}

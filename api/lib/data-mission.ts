import type { Data } from './schema.js';
import { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import { InferSelectModel } from 'drizzle-orm';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';
import type { MissionLayer } from '@tak-ps/node-tak/lib/api/mission-layer';
import { MissionLayerType } from '@tak-ps/node-tak/lib/api/mission-layer';
import Config from './config.js';
import type { Mission } from '@tak-ps/node-tak/lib/api/mission';

export const MAX_LAYERS_IN_DATA_SYNC = 5;

export default class DataMission {
    /**
     * Return a TAK Mission Response if the given mission exists,
     * or attempt to create the mission if it doesn't
     */
    static async sync(config: Config, data: InferSelectModel<typeof Data>): Promise<Static<typeof Mission> | void> {
        const connection = await config.models.Connection.from(data.connection);

        const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

        // All groups should be active for data-sync api to work properly
        const groups = await api.Group.list({ useCache: true });
        if (groups.data.some((g) => { return !g.active })) {
            await api.Group.update(groups.data.map((group) => {
                group.active = true;
                return group;
            }), {})
        }

        let mission;

        try {
            mission = await api.Mission.get(data.name, {}, {
                token: data.mission_token || undefined
            });

            //TODO Update Groups: Not supported by TAK Server at this time

            if (!data.mission_sync) {
                await api.Mission.delete(data.name, {}, {
                    token: data.mission_token || undefined
                });
                return;
            }
        } catch (err) {
            console.error(err);
            if (!data.mission_sync) return;

            if (!data.mission_groups.length) {
                data.mission_groups = groups.data.map((group) => { return group.name });
            }

            let mission = await api.Mission.create({
                name: data.name,
                creatorUid: `connection-${data.connection}-data-${data.id}`,
                description: data.description,
                defaultRole: data.mission_role,
                group: data.mission_groups,
            });

            await config.models.Data.commit(data.id, {
                mission_token: mission.token || undefined
            });

            const conn = config.conns.get(data.connection);
            if (conn) {
                await api.Mission.subscribe(data.name, {
                    uid: conn.config.uid()
                },{
                    token: mission.token || undefined
                });
            }

            // The groups property isn't returned by Create
            // Make this second call to get the groups - TODO Talk to Josh
            mission = await api.Mission.get(data.name, {}, {
                token: data.mission_token || undefined
            });
        }

        const layers = await config.models.Layer.augmented_list({
            limit: MAX_LAYERS_IN_DATA_SYNC,
            where: sql`layers_incoming.data = ${data.id}`
        });

        const existMap: Map<string, Static<typeof MissionLayer>> = new Map();
        for (const l of (await api.MissionLayer.list(
            data.name,
            { token: data.mission_token || undefined }
        )).data) existMap.set(l.uid, l);

        for (const l of layers.items) {
            const exists = existMap.get(`layer-${l.id}`);

            if (!exists) {
                await api.MissionLayer.create(
                    data.name,
                    {
                        uid: `layer-${l.id}`,
                        name: l.name,
                        type: MissionLayerType.UID,
                        creatorUid: `connection-${data.connection}-data-${data.id}`
                    },
                    { token: data.mission_token || undefined }
                );
            } else {
                if (exists.type !== MissionLayerType.UID) {
                    await api.MissionLayer.delete(
                        data.name,
                        {
                            uid: [`layer-${l.id}`],
                            creatorUid: `connection-${data.connection}-data-${data.id}`
                        },
                        { token: data.mission_token || undefined }
                    );

                    await api.MissionLayer.create(
                        data.name,
                        {
                            uid: `layer-${l.id}`,
                            name: l.name,
                            type: MissionLayerType.UID,
                            creatorUid: `connection-${data.connection}-data-${data.id}`
                        },
                        { token: data.mission_token || undefined }
                    );
                }

                // Check for Name Mismatch - rename
            }
        }

        return mission;
    }
}

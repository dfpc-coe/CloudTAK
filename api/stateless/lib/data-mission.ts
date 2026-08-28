import type { Data } from '../../common/schema.js';
import { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import { InferSelectModel } from 'drizzle-orm';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import type { MissionLayer } from '@tak-ps/node-tak/lib/api/mission-layer';
import { MissionLayerType } from '@tak-ps/node-tak/lib/api/mission-layer';
import Config from '../../common/config.js';
import ConnectionControl from '../../common/control/connection.js';
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
        if (groups.data.some(g => !g.active)) {
            await api.Group.update(groups.data.map((group) => {
                group.active = true;
                return group;
            }), {});
        }

        let mission;

        try {
            mission = await api.Mission.get(data.mission_guid || data.name, {}, {
                token: data.mission_token || undefined,
            });

            if (mission.guid && mission.guid !== data.mission_guid) {
                await config.models.Data.commit(data.id, { mission_guid: mission.guid });
                data.mission_guid = mission.guid;
            }

            // TODO Update Groups: Not supported by TAK Server at this time

            if (!data.mission_sync) {
                await api.Mission.delete(data.mission_guid || data.name, {}, {
                    token: data.mission_token || undefined,
                });
                return;
            }
        } catch (err) {
            console.error(err);
            if (!data.mission_sync) {
                return;
            }

            if (!data.mission_groups.length) {
                data.mission_groups = groups.data.map(group => group.name);
            }

            const mission = await api.Mission.create({
                name: data.name,
                creatorUid: `connection-${data.connection}-data-${data.id}`,
                description: data.description,
                defaultRole: data.mission_role,
                group: data.mission_groups,
            });

            await config.models.Data.commit(data.id, {
                mission_token: mission.token || undefined,
                mission_guid: mission.guid,
            });
            data.mission_guid = mission.guid;

            if (connection.enabled) {
                await api.Mission.subscribe(data.mission_guid || data.name, {
                    uid: ConnectionControl.uid(connection.auth.cert),
                }, {
                    token: mission.token || undefined,
                });
            }
        }

        const layers = await config.models.Layer.augmented_list({
            limit: MAX_LAYERS_IN_DATA_SYNC,
            where: sql`layers_incoming.data = ${data.id}`,
        });

        const missionId = data.mission_guid || data.name;

        const existMap: Map<string, Static<typeof MissionLayer>> = new Map();
        for (const l of (await api.MissionLayer.list(
            missionId,
            { token: data.mission_token || undefined },
        )).data) existMap.set(l.uid, l);

        for (const l of layers.items) {
            const exists = existMap.get(`layer-${l.id}`);

            if (!exists) {
                await api.MissionLayer.create(
                    missionId,
                    {
                        uid: `layer-${l.id}`,
                        name: l.name,
                        type: MissionLayerType.UID,
                        creatorUid: `connection-${data.connection}-data-${data.id}`,
                    },
                    { token: data.mission_token || undefined },
                );
            } else {
                if (exists.type !== MissionLayerType.UID) {
                    await api.MissionLayer.delete(
                        missionId,
                        {
                            uid: [`layer-${l.id}`],
                            creatorUid: `connection-${data.connection}-data-${data.id}`,
                        },
                        { token: data.mission_token || undefined },
                    );

                    await api.MissionLayer.create(
                        missionId,
                        {
                            uid: `layer-${l.id}`,
                            name: l.name,
                            type: MissionLayerType.UID,
                            creatorUid: `connection-${data.connection}-data-${data.id}`,
                        },
                        { token: data.mission_token || undefined },
                    );
                }

                // Check for Name Mismatch - rename
            }
        }

        return mission;
    }
}

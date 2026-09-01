import crypto from 'node:crypto';
import type { Static } from '@sinclair/typebox';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { ConnectionFeature } from '../../../common/schema.js';
import Style from '../../../common/style.js';
import type ConfigStateless from '../../config.js';
import { CoTParser, Feature } from '@tak-ps/node-cot';
import { MissionLayerType } from '@tak-ps/node-tak/lib/api/mission-layer';
import type { AugmentedLayer } from '../../../common/models/Layer.js';
import type { LayerError } from '../../../common/types.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export type CoreFeatureSubmitOptions = {
    /** UIDs present in the submission - required for DataSync layers with MissionDiff enabled */
    uids?: Array<string>;

    /** Save features to the ConnectionFeature table (default true) */
    archive?: boolean;

    /** Style to apply to submitted Features - defaults to the Layer's incoming style config */
    style?: Style;
};

/**
 * Style & submit GeoJSON Features to the TAK Server on behalf of a Layer -
 * shared by the CoT submission and arbitrary JSON submission APIs
 */
export default class CoreFeatureControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    async submit(
        layer: Static<typeof AugmentedLayer>,
        features: Array<Static<typeof Feature.InputFeature>>,
        opts: CoreFeatureSubmitOptions = {},
    ): Promise<Array<Static<typeof LayerError>>> {
        if (!layer.connection) throw new Err(400, null, 'Layer is not attached to a Connection');
        if (!layer.incoming) throw new Err(400, null, 'Incoming Layer Configuration has not been applied');

        const style = opts.style || new Style(layer.incoming);

        const styled = [];
        for (let i = 0; i < features.length; i++) {
            if (!features[i].properties) features[i].properties = {};

            const styledFeat = await style.feat(features[i]);
            if (!styledFeat) continue;

            if (styledFeat.properties.flow === undefined) {
                styledFeat.properties.flow = {};
            }

            styledFeat.properties.flow[`CloudTAK-Layer-${layer.id}`] = new Date().toISOString();

            styled.push(styledFeat);
        }

        features = styled;

        let data;
        let dataConnection;
        let connectionId = layer.connection;

        if (layer.incoming.data) {
            data = await this.config.models.Data.from(layer.incoming.data);
            connectionId = data.connection;

            dataConnection = await this.config.models.Connection.from(connectionId);

            if (!dataConnection.enabled) {
                throw new Err(200, null, 'Received but Connection Paused');
            }

            const status = (await this.config.hub.connectionStatus([connectionId]))[String(connectionId)];
            if (status === 'unknown') {
                throw new Err(500, null, `Pooled Client for ${connectionId} not found in config`);
            }
        } else if (!layer.parent || !layer.parent.enabled) {
            throw new Err(200, null, 'Received but Connection Paused');
        }

        const errors: Array<Static<typeof LayerError>> = [];
        let cots = [];
        for (const feat of features) {
            try {
                cots.push(await CoTParser.from_geojson(feat));
            } catch (err) {
                errors.push({
                    error: err instanceof Error ? err.message : String(err),
                    feature: feat,
                });

                console.error(`Failed to decode ${String(err)}: feature: ${feat.id}`);
            }
        }

        if (layer.incoming.data && data && dataConnection) {
            if (!data.mission_sync) {
                throw new Err(202, null, 'Received but Data Mission Sync Disabled');
            }

            // Mission Sync Features are always archived
            for (const cot of cots.values()) {
                cot.archived(true);
            }

            if (data.mission_diff) {
                if (!Array.isArray(opts.uids)) {
                    throw new Err(400, null, 'uids Array must be present when submitting to DataSync with MissionDiff');
                }

                const api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(dataConnection.auth.cert, dataConnection.auth.key));
                // Once NodeJS supports Set.difference we can simplify this
                const inputFeats = new Set(opts.uids);

                const { features } = await api.MissionLayer.latestFeats(
                    data.mission_guid || data.name,
                    `layer-${layer.id}`,
                    { token: data.mission_token || undefined },
                );

                for (const feat of features.values()) {
                    if (!inputFeats.has(String(feat.id))) {
                        /** TODO Add in 5.3 once MissionAPI supports t-x-d-d
                         *  const cot = new ForceDelete(String(feat.id));
                         *  cot.addDest({ mission: data.name, path: `layer-${layer.id}`, after: '' });
                         *  cots.push(cot);
                         */
                        await api.Mission.detachContents(
                            data.mission_guid || data.name,
                            { uid: String(feat.id) },
                            { token: data.mission_token || undefined },
                        );
                    }
                }

                const existMap: Map<string, Static<typeof Feature.Feature>> = new Map();
                for (const feat of features) {
                    existMap.set(String(feat.id), feat);
                }

                const pathMap = await api.MissionLayer.listAsPathMap(
                    data.mission_guid || data.name,
                    { token: data.mission_token || undefined },
                );

                for (const cot of cots) {
                    const path = cot.path.split('/').filter(p => !!p);

                    let pathMapEntryLast = pathMap.get(`/${encodeURIComponent(layer.name)}/`);
                    if (!pathMapEntryLast) continue;

                    const pathSegs = [];
                    for (const p of path) {
                        pathSegs.push(encodeURIComponent(p));

                        const currentPath = `/${encodeURIComponent(layer.name)}/${pathSegs.join('/')}/`;
                        const pathMapEntry = pathMap.get(currentPath);

                        if (!pathMapEntry) {
                            const missionLayer = await api.MissionLayer.create(
                                data.mission_guid || data.name,
                                {
                                    uid: `layer-${layer.id}-${crypto.randomUUID()}`,
                                    name: p,
                                    type: MissionLayerType.UID,
                                    parentUid: pathMapEntryLast.uid,
                                    creatorUid: `connection-${data.connection}-data-${data.id}`,
                                },
                                { token: data.mission_token || undefined },
                            );

                            pathMap.set(currentPath, missionLayer.data);

                            pathMapEntryLast = missionLayer.data;
                        } else {
                            pathMapEntryLast = pathMapEntry;
                        }
                    }

                    cot.addDest({ mission: data.name, path: pathMapEntryLast.uid, after: '' });
                    if (!pathMapEntryLast.uids) pathMapEntryLast.uids = [];
                    pathMapEntryLast.uids.push({ data: cot.uid(), timestamp: new Date().toISOString(), creatorUid: `connection-${data.connection}-data-${data.id}` });
                }

                for (const [key, pathLayer] of pathMap.entries()) {
                    // TODO: This currently doesn't handle that if a leaf is deleted, the parent node, now a leaf
                    // might be empty now

                    if (
                        !key.startsWith(`/${encodeURIComponent(layer.name)}/`)
                        || key === `/${encodeURIComponent(layer.name)}/`
                    ) {
                        continue;
                    }

                    if (api.MissionLayer.isEmpty(pathLayer)) {
                        await api.MissionLayer.delete(
                            data.mission_guid || data.name,
                            {
                                uid: [pathLayer.uid],
                                creatorUid: `connection-${data.connection}-data-${data.id}`,
                            },
                            { token: data.mission_token || undefined },
                        );
                    }
                }

                const filtered = [];

                for (const cot of cots) {
                    const exist = existMap.get(cot.uid());
                    if (exist && data.mission_diff) {
                        const b = await CoTParser.from_geojson(exist);
                        // TODO: Check for path change
                        if (!(await CoTParser.isDiff(cot, b))) continue;
                    }

                    filtered.push(cot);
                }

                cots = filtered;
            } else {
                for (const cot of cots) {
                    cot.addDest({ mission: data.name });
                }
            }
        } else {
            cots = cots.filter(cot => !cot.is_stale());

            const insertValues = [];
            for (const cot of cots) {
                insertValues.push({
                    path: '/',
                    connection: layer.connection,
                    layer: layer.id,
                    ...(await CoTParser.to_geojson(cot)),
                });
            }

            try {
                if (insertValues.length && opts.archive !== false) {
                    const INSERT_BATCH = 10000;

                    for (let i = 0; i < insertValues.length; i += INSERT_BATCH) {
                        await this.config.models.ConnectionFeature.generate(insertValues.slice(i, i + INSERT_BATCH), {
                            upsert: GenerateUpsert.UPDATE,
                            upsertTarget: [ConnectionFeature.connection, ConnectionFeature.id],
                        });
                    }
                }
            } catch (err) {
                // We don't throw as priority is TAK Server Delivery
                console.error(err);
            }
        }

        if (cots.length === 0 && !errors.length) {
            throw new Err(200, null, 'No features found');
        }

        await this.config.hub.submitCots({
            connection: connectionId,
            cots,
            broadcast: true,
        });

        return errors;
    }
}

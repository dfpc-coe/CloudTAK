import type { Static } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { Value } from '@sinclair/typebox/value';
import { sql } from 'drizzle-orm';
import jsonata from 'jsonata';
import Err from '@openaddresses/batch-error';
import Style, { StyleContainer } from '../../../common/style.js';
import { Feature } from '@tak-ps/node-cot';
import { GenericListOrder } from '@openaddresses/batch-generic';
import { hasScope } from '../../../common/auth.js';
import { CoreEvent, CoreDevice, CoreEventChannel, CoreDeviceChannel, LayerMap } from '../../../common/schema.js';
import { LayerMap_Type } from '../../../common/enums.js';
import type ConfigStateless from '../../config.js';
import type { AugmentedLayer } from '../../../common/models/Layer.js';
import CoreFeatureControl from './CoreFeature.js';
import {
    LayerMapMapping,
    LayerMapCoreEventMapping,
    LayerMapCoreDeviceMapping,
    LayerMapCoreEventSubmission,
    LayerMapCoreDeviceSubmission,
    LayerMapSubmissionResult,
    LayerMapSubmissionError,
} from '../../../common/types.js';
import type { InferSelectModel } from 'drizzle-orm';

// JSONata throws plain objects with a message property rather than Errors
function errMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) return String(err.message);
    return String(err);
}

const FeatureChecker = TypeCompiler.Compile(Feature.InputFeature);
const CoreEventChecker = TypeCompiler.Compile(LayerMapCoreEventSubmission);
const CoreDeviceChecker = TypeCompiler.Compile(LayerMapCoreDeviceSubmission);

export type LayerMapSubmitResult = {
    results: Array<Static<typeof LayerMapSubmissionResult>>;
    errors: Array<Static<typeof LayerMapSubmissionError>>;
};

export type LayerMapAction = 'create' | 'update';

type LayerMapScopes = {
    create: boolean;
    update: boolean;
};

/**
 * Map arbitrary JSON payloads submitted to a Layer into CoreFeatures,
 * CoreEvents or CoreDevices based on the Layer's configured Maps
 */
export default class LayerMapControl {
    config: ConfigStateless;
    coreFeature: CoreFeatureControl;

    constructor(config: ConfigStateless) {
        this.config = config;
        this.coreFeature = new CoreFeatureControl(config);
    }

    /**
     * `<permission>:<level>` scope a Map must hold in the Layer's permissions
     * to perform an action - CoreFeature Maps only ever submit
     */
    static requiredScope(type: LayerMap_Type, action: LayerMapAction = 'create'): string {
        if (type === LayerMap_Type.COREFEATURE) return 'feature:submit';
        return `${type === LayerMap_Type.COREEVENT ? 'event' : 'device'}:${action}`;
    }

    /**
     * Can a Map of the given type perform an action under the Layer's permissions
     */
    static hasMapScope(permissions: Array<string>, type: LayerMap_Type, action: LayerMapAction = 'create'): boolean {
        return hasScope(permissions, this.requiredScope(type, action));
    }

    /**
     * Ensure the JSONata query compiles and the mapping matches the Map type
     */
    static validate(type: LayerMap_Type, query: string, mapping: Static<typeof LayerMapMapping>): void {
        try {
            jsonata(query);
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(errMessage(err)), `Invalid JSONata Query: ${errMessage(err)}`);
        }

        if (type === LayerMap_Type.COREFEATURE) {
            Style.validate(mapping as Static<typeof StyleContainer>);
        } else {
            const schema = type === LayerMap_Type.COREEVENT ? LayerMapCoreEventMapping : LayerMapCoreDeviceMapping;

            if (!Value.Check(schema, mapping)) {
                const first = Value.Errors(schema, mapping).First();
                throw new Err(400, null, `Invalid ${type} Mapping: ${first ? `${first.path} ${first.message}` : 'does not match schema'}`);
            }
        }
    }

    /**
     * Run every enabled Map of the Layer against the submitted payload
     */
    async submit(
        layer: Static<typeof AugmentedLayer>,
        payload: unknown,
    ): Promise<LayerMapSubmitResult> {
        const maps = await this.config.models.LayerMap.list({
            limit: 100,
            sort: 'created',
            order: GenericListOrder.ASC,
            where: sql`layer = ${layer.id} AND enabled = True`,
        });

        if (maps.total === 0) throw new Err(400, null, 'Layer has no enabled Maps configured');

        const results: Array<Static<typeof LayerMapSubmissionResult>> = [];
        const errors: Array<Static<typeof LayerMapSubmissionError>> = [];

        for (const map of maps.items) {
            const scopes: LayerMapScopes = {
                create: LayerMapControl.hasMapScope(layer.permissions, map.type, 'create'),
                update: map.type === LayerMap_Type.COREFEATURE
                    ? LayerMapControl.hasMapScope(layer.permissions, map.type, 'create')
                    : LayerMapControl.hasMapScope(layer.permissions, map.type, 'update'),
            };

            try {
                let evaluated = await jsonata(map.query).evaluate(payload);

                // JSONata constructs null-prototype objects - normalize to plain JSON
                if (evaluated !== undefined) {
                    evaluated = JSON.parse(JSON.stringify(evaluated));
                }

                const items = evaluated === undefined || evaluated === null
                    ? []
                    : Array.isArray(evaluated) ? evaluated : [evaluated];

                const result: Static<typeof LayerMapSubmissionResult> = {
                    map: map.id,
                    name: map.name,
                    type: map.type,
                    count: 0,
                };

                if (items.length) {
                    if (!scopes.create && !scopes.update) {
                        const required = map.type === LayerMap_Type.COREFEATURE
                            ? LayerMapControl.requiredScope(map.type)
                            : `${LayerMapControl.requiredScope(map.type, 'create')} or ${LayerMapControl.requiredScope(map.type, 'update')}`;

                        errors.push({
                            map: map.id,
                            name: map.name,
                            error: `Map exceeds Layer permissions - the Layer does not have the ${required} permission`,
                        });

                        continue;
                    }

                    if (map.type === LayerMap_Type.COREFEATURE) {
                        result.count = await this.#submitFeatures(layer, map, items, errors);
                    } else if (map.type === LayerMap_Type.COREEVENT) {
                        result.count = await this.#submitEvents(layer, map, items, errors, scopes);
                    } else if (map.type === LayerMap_Type.COREDEVICE) {
                        result.count = await this.#submitDevices(layer, map, items, errors, scopes);
                    }
                }

                results.push(result);
            } catch (err) {
                if (err instanceof Err && (err.status === 200 || err.status === 202)) {
                    results.push({
                        map: map.id,
                        name: map.name,
                        type: map.type,
                        count: 0,
                        message: err.message,
                    });
                } else {
                    errors.push({
                        map: map.id,
                        name: map.name,
                        error: errMessage(err),
                    });
                }
            }
        }

        return { results, errors };
    }

    async #submitFeatures(
        layer: Static<typeof AugmentedLayer>,
        map: InferSelectModel<typeof LayerMap>,
        items: Array<unknown>,
        errors: Array<Static<typeof LayerMapSubmissionError>>,
    ): Promise<number> {
        const features: Array<Static<typeof Feature.InputFeature>> = [];

        for (const item of items) {
            const candidate = Value.Default(Feature.InputFeature, Value.Clone(item));

            if (FeatureChecker.Check(candidate)) {
                features.push(candidate);
            } else {
                const first = FeatureChecker.Errors(candidate).First();
                errors.push({
                    map: map.id,
                    name: map.name,
                    error: `Query output is not a valid Feature: ${first ? `${first.path} ${first.message}` : 'does not match schema'}`,
                });
            }
        }

        if (!features.length) return 0;

        const style = new Style({
            enabled_styles: true,
            styles: map.mapping as Static<typeof StyleContainer>,
        });

        const submitErrors = await this.coreFeature.submit(layer, features, { style });

        for (const err of submitErrors) {
            errors.push({
                map: map.id,
                name: map.name,
                error: err.error,
            });
        }

        return features.length - submitErrors.length;
    }

    async #submitEvents(
        layer: Static<typeof AugmentedLayer>,
        map: InferSelectModel<typeof LayerMap>,
        items: Array<unknown>,
        errors: Array<Static<typeof LayerMapSubmissionError>>,
        scopes: LayerMapScopes,
    ): Promise<number> {
        const { channels, ...defaults } = map.mapping as Static<typeof LayerMapCoreEventMapping>;

        let count = 0;
        for (const item of items) {
            const merged = Value.Default(LayerMapCoreEventSubmission, {
                ...defaults,
                ...(typeof item === 'object' && item !== null ? item : {}),
            });

            if (!CoreEventChecker.Check(merged)) {
                const first = CoreEventChecker.Errors(merged).First();
                errors.push({
                    map: map.id,
                    name: map.name,
                    error: `Query output is not a valid Core Event: ${first ? `${first.path} ${first.message}` : 'does not match schema'}`,
                });

                continue;
            }

            let existingId: string | undefined;
            if (merged.external_id) {
                const existing = await this.config.models.CoreEvent.list({
                    limit: 1,
                    where: sql`external_id = ${merged.external_id} AND connection = ${layer.connection}`,
                });

                if (existing.total > 0) existingId = existing.items[0].id;
            }

            const action: LayerMapAction = existingId ? 'update' : 'create';
            if (!scopes[action]) {
                errors.push({
                    map: map.id,
                    name: map.name,
                    error: `${action === 'update' ? `Updating Core Event ${merged.external_id}` : 'Creating a Core Event'} exceeds Layer permissions - the ${LayerMapControl.requiredScope(map.type, action)} permission is required`,
                });

                continue;
            }

            let event: InferSelectModel<typeof CoreEvent>;
            if (existingId) {
                event = await this.config.models.CoreEvent.commit(existingId, {
                    ...merged,
                    updated: sql`Now()`,
                });
            } else {
                event = await this.config.models.CoreEvent.generate({
                    ...merged,
                    connection: layer.connection,
                });

                const newEventId = event.id;
                if (channels && channels.length > 0) {
                    await this.config.pg.insert(CoreEventChannel)
                        .values(channels.map(ch => ({
                            event: newEventId,
                            channel: BigInt(ch),
                        })));
                }
            }

            // Best effort - a failed immediate submit is recovered by the
            // Admin Connection's next scheduled submit cycle
            const eventId = event.id;
            this.config.hub.coreEventSubmit(eventId).catch((err) => {
                console.error(`not ok - failed to immediately submit Core Event ${eventId}:`, err);
            });

            count++;
        }

        return count;
    }

    async #submitDevices(
        layer: Static<typeof AugmentedLayer>,
        map: InferSelectModel<typeof LayerMap>,
        items: Array<unknown>,
        errors: Array<Static<typeof LayerMapSubmissionError>>,
        scopes: LayerMapScopes,
    ): Promise<number> {
        const { channels, ...defaults } = map.mapping as Static<typeof LayerMapCoreDeviceMapping>;

        let count = 0;
        for (const item of items) {
            const merged = Value.Default(LayerMapCoreDeviceSubmission, {
                ...defaults,
                ...(typeof item === 'object' && item !== null ? item : {}),
            });

            if (!CoreDeviceChecker.Check(merged)) {
                const first = CoreDeviceChecker.Errors(merged).First();
                errors.push({
                    map: map.id,
                    name: map.name,
                    error: `Query output is not a valid Core Device: ${first ? `${first.path} ${first.message}` : 'does not match schema'}`,
                });

                continue;
            }

            let existingId: string | undefined;
            if (merged.external_id) {
                const existing = await this.config.models.CoreDevice.list({
                    limit: 1,
                    where: sql`external_id = ${merged.external_id} AND connection = ${layer.connection}`,
                });

                if (existing.total > 0) existingId = existing.items[0].id;
            }

            const action: LayerMapAction = existingId ? 'update' : 'create';
            if (!scopes[action]) {
                errors.push({
                    map: map.id,
                    name: map.name,
                    error: `${action === 'update' ? `Updating Core Device ${merged.external_id}` : 'Creating a Core Device'} exceeds Layer permissions - the ${LayerMapControl.requiredScope(map.type, action)} permission is required`,
                });

                continue;
            }

            if (existingId) {
                await this.config.models.CoreDevice.commit(existingId, {
                    ...merged,
                    updated: sql`Now()`,
                });
            } else {
                const device: InferSelectModel<typeof CoreDevice> = await this.config.models.CoreDevice.generate({
                    ...merged,
                    connection: layer.connection,
                });

                const deviceId = device.id;
                if (channels && channels.length > 0) {
                    await this.config.pg.insert(CoreDeviceChannel)
                        .values(channels.map(ch => ({
                            device: deviceId,
                            channel: BigInt(ch),
                        })));
                }
            }

            count++;
        }

        return count;
    }
}

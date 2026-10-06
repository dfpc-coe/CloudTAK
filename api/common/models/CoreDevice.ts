import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreDeviceResponse } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreEntity, CoreEntityDevice } from '../schema.js';
import { LayerMapping_Destination } from '../enums.js';
import type { PgInsertValue } from 'drizzle-orm/pg-core';
import { SQL, is, sql, eq, asc, desc, getTableColumns } from 'drizzle-orm';
import { EntityColumns, splitEntity, channelsSubquery } from './CoreEntity.js';
import type { WithSQL, Writer } from './CoreEntity.js';

/** Device side table columns - the shared primary key is already selected from core_entity */
const DeviceColumns = Object.fromEntries(
    Object.entries(getTableColumns(CoreEntityDevice)).filter(([name]) => name !== 'id'),
) as Omit<ReturnType<typeof getTableColumns<typeof CoreEntityDevice>>, 'id'>;

const DEVICE_KEYS = new Set(Object.keys(DeviceColumns));

export type CoreDeviceInsert = WithSQL<Omit<typeof CoreEntity.$inferInsert, 'kind'> & Omit<typeof CoreEntityDevice.$inferInsert, 'id'>>;
export type CoreDeviceUpdate = Partial<WithSQL<Omit<typeof CoreEntity.$inferInsert, 'id' | 'kind'> & Omit<typeof CoreEntityDevice.$inferInsert, 'id'>>>;

export function splitDevice(values: Record<string, unknown>): { entity: Record<string, unknown>; device: Record<string, unknown> } {
    const { entity, side } = splitEntity(values, DEVICE_KEYS);
    return { entity, device: side };
}

/** CoreEntities of kind CoreDevice - the join on core_entity_device selects the kind */
export default class CoreDeviceModel extends Modeler<typeof CoreEntity> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreEntity);
    }

    /** Create a Device across core_entity & core_entity_device - returns the new id */
    async generateDevice(values: CoreDeviceInsert, tx: Writer = this.pool): Promise<string> {
        const { entity, device } = splitDevice(values);

        const [row] = await tx.insert(CoreEntity)
            .values({ ...entity, kind: LayerMapping_Destination.COREDEVICE } as PgInsertValue<typeof CoreEntity>)
            .returning({ id: CoreEntity.id });

        await tx.insert(CoreEntityDevice).values({ ...device, id: row.id });

        return row.id;
    }

    /** Update a Device across core_entity & core_entity_device - core_entity.updated is always touched */
    async commitDevice(id: string, values: CoreDeviceUpdate, tx: Writer = this.pool): Promise<void> {
        const { entity, device } = splitDevice(values);

        const updated = await tx.update(CoreEntity)
            .set({ ...entity, updated: sql`Now()` })
            .where(eq(CoreEntity.id, id))
            .returning({ id: CoreEntity.id });

        if (!updated.length) throw new Err(404, null, 'Item Not Found');

        if (Object.keys(device).length) {
            await tx.update(CoreEntityDevice)
                .set(device)
                .where(eq(CoreEntityDevice.id, id));
        }
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof CoreDeviceResponse>> {
        const SubTable = channelsSubquery(this.pool);

        const pgres = await this.pool
            .select({
                device: { ...EntityColumns, ...DeviceColumns },
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreEntity)
            .innerJoin(CoreEntityDevice, eq(CoreEntity.id, CoreEntityDevice.id))
            .leftJoin(SubTable, eq(CoreEntity.id, SubTable.entity))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].device,
            geometry: pgres[0].device.geometry as Static<typeof CoreDeviceResponse>['geometry'],
            channels: pgres[0].channels as number[],
        };
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof CoreDeviceResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = channelsSubquery(this.pool);

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                device: { ...EntityColumns, ...DeviceColumns },
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreEntity)
            .innerJoin(CoreEntityDevice, eq(CoreEntity.id, CoreEntityDevice.id))
            .leftJoin(SubTable, eq(CoreEntity.id, SubTable.entity))
            .where(query.where)
            .orderBy(orderBy)
            .limit(query.limit || 10)
            .offset((query.page || 0) * (query.limit || 10));

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        } else {
            return {
                total: parseInt(pgres[0].count),
                items: pgres.map((t) => {
                    return {
                        ...t.device,
                        geometry: t.device.geometry as Static<typeof CoreDeviceResponse>['geometry'],
                        channels: t.channels as number[],
                    };
                }),
            };
        }
    }
}

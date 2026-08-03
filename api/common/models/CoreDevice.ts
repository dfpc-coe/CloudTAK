import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreDeviceResponse, GeoJSONFeatureGeometryPoint } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreDevice, CoreDeviceChannel } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

export default class CoreDeviceModel extends Modeler<typeof CoreDevice> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreDevice);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof CoreDeviceResponse>> {
        const SubTable = this.pool
            .select({
                device: CoreDeviceChannel.device,
                channels: sql`JSON_AGG(core_device_channel.channel::BIGINT ORDER BY core_device_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreDeviceChannel)
            .groupBy(CoreDeviceChannel.device)
            .as('channels');

        const pgres = await this.pool
            .select({
                device: CoreDevice,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreDevice)
            .leftJoin(SubTable, eq(CoreDevice.id, SubTable.device))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].device,
            geometry: pgres[0].device.geometry as Static<typeof GeoJSONFeatureGeometryPoint> | null,
            channels: pgres[0].channels as number[],
        };
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof CoreDeviceResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                device: CoreDeviceChannel.device,
                channels: sql`JSON_AGG(core_device_channel.channel::BIGINT ORDER BY core_device_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreDeviceChannel)
            .groupBy(CoreDeviceChannel.device)
            .as('channels');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                device: CoreDevice,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreDevice)
            .leftJoin(SubTable, eq(CoreDevice.id, SubTable.device))
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
                        geometry: t.device.geometry as Static<typeof GeoJSONFeatureGeometryPoint> | null,
                        channels: t.channels as number[],
                    };
                }),
            };
        }
    }
}

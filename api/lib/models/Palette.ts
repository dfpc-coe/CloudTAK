import Err from '@openaddresses/batch-error'
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox'
import { PaletteResponse } from '../types.js'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Palette, PaletteFeature } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

export default class PaletteModel extends Modeler<typeof Palette> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Palette);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof PaletteResponse>> {
        const SubTable = this.pool
            .select({
                uuid: PaletteFeature.palette,
                features: sql`JSON_AGG(palette_feature.*)`.as('features')
            })
            .from(PaletteFeature)
            .groupBy(PaletteFeature.palette)
            .as('features');

        const pgres = await this.pool
            .select({
                palette: Palette,
                features: sql`COALESCE(${SubTable.features}, '[]'::JSON)`.as('features')
            })
            .from(Palette)
            .leftJoin(SubTable, eq(Palette.uuid, SubTable.uuid))
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].palette,
            features: pgres[0].features
        } as Static<typeof PaletteResponse>;
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof PaletteResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                uuid: PaletteFeature.palette,
                features: sql`JSON_AGG(palette_feature.*)`.as('features')
            })
            .from(PaletteFeature)
            .groupBy(PaletteFeature.palette)
            .as('features');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                palette: Palette,
                features: sql`COALESCE(${SubTable.features}, '[]'::JSON)`.as('features')
            })
            .from(Palette)
            .leftJoin(SubTable, eq(Palette.uuid, SubTable.uuid))
            .where(query.where)
            .orderBy(orderBy)
            .limit(query.limit || 10)
            .offset((query.page || 0) * (query.limit || 10))

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        } else {
            return {
                total: parseInt(pgres[0].count),
                items: pgres.map((t) => {
                    return {
                        ...t.palette,
                        features: t.features,
                        count: undefined
                    } as Static<typeof PaletteResponse>
                })
            };
        }
    }
}

import Modeler, { GenericListInput } from '@openaddresses/batch-generic';
import { Static, Type } from '@sinclair/typebox'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Basemap, BasemapVector, BasemapRaster, BasemapTerrain } from '../schema.js';
import { desc, eq, sql } from 'drizzle-orm';
import { Basemap_Type } from '../enums.js';

export const BasemapCollection = Type.Object({
    name: Type.String()
});

export default class BasemapModel extends Modeler<typeof Basemap> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Basemap);
    }

    async generate(input: any): Promise<any> {
        const base = await super.generate({
            name: input.name,
            url: input.url,
            bounds: input.bounds,
            center: input.center,
            minzoom: input.minzoom,
            maxzoom: input.maxzoom,
            format: input.format,
            type: input.type,
            username: input.username,
            sharing_enabled: input.sharing_enabled,
            sharing_token: input.sharing_token,
            hidden: input.hidden,
            tilesize: input.tilesize,
            attribution: input.attribution,
            collection: input.collection,
            frequency: input.frequency,
            scheme: input.scheme,
            overlay: input.overlay
        });

        if (input.type === Basemap_Type.VECTOR) {
            await this.pool.insert(BasemapVector).values({
                basemap: base.id,
                styles: input.styles,
                iconset: input.iconset,
                snapping_enabled: input.snapping_enabled,
                title: input.title,
                snapping_layer: input.snapping_layer
            });
        } else if (input.type === Basemap_Type.TERRAIN) {
            await this.pool.insert(BasemapTerrain).values({
                basemap: base.id
            });
        } else {
            await this.pool.insert(BasemapRaster).values({
                basemap: base.id
            });
        }

        return this.from(base.id);
    }

    async from(id: number): Promise<any> {
        const base = await super.from(id);

        let specific;
        if (base.type === Basemap_Type.VECTOR) {
            const res = await this.pool.select().from(BasemapVector).where(eq(BasemapVector.basemap, base.id));
            specific = res[0];
        } else if (base.type === Basemap_Type.TERRAIN) {
            const res = await this.pool.select().from(BasemapTerrain).where(eq(BasemapTerrain.basemap, base.id));
            specific = res[0];
        } else {
            const res = await this.pool.select().from(BasemapRaster).where(eq(BasemapRaster.basemap, base.id));
            specific = res[0];
        }

        return {
            styles: [],
            iconset: '',
            snapping_enabled: false,
            title: 'callsign',
            snapping_layer: null,
            ...specific,
            ...base,
        };
    }

    async commit(id: number, input: any): Promise<any> {
        const base = await super.commit(id, {
            name: input.name,
            url: input.url,
            bounds: input.bounds,
            center: input.center,
            minzoom: input.minzoom,
            maxzoom: input.maxzoom,
            format: input.format,
            type: input.type,
            username: input.username,
            sharing_enabled: input.sharing_enabled,
            sharing_token: input.sharing_token,
            hidden: input.hidden,
            tilesize: input.tilesize,
            attribution: input.attribution,
            collection: input.collection,
            overlay: input.overlay,
            frequency: input.frequency,
            scheme: input.scheme,
            updated: input.updated
        });

        if (base.type === Basemap_Type.VECTOR) {
            const vector: any = {};
            if (input.styles !== undefined) vector.styles = input.styles;
            if (input.iconset !== undefined) vector.iconset = input.iconset;
            if (input.snapping_enabled !== undefined) vector.snapping_enabled = input.snapping_enabled;
            if (input.title !== undefined) vector.title = input.title;
            if (input.snapping_layer !== undefined) vector.snapping_layer = input.snapping_layer;

            await this.pool.insert(BasemapVector).values({
                basemap: base.id,
                ...vector
            }).onConflictDoUpdate({
                target: BasemapVector.basemap,
                set: vector
            });
            await this.pool.delete(BasemapRaster).where(eq(BasemapRaster.basemap, base.id));
            await this.pool.delete(BasemapTerrain).where(eq(BasemapTerrain.basemap, base.id));
        } else if (base.type === Basemap_Type.TERRAIN) {
            await this.pool.insert(BasemapTerrain).values({
                basemap: base.id
            }).onConflictDoNothing();
            await this.pool.delete(BasemapRaster).where(eq(BasemapRaster.basemap, base.id));
            await this.pool.delete(BasemapVector).where(eq(BasemapVector.basemap, base.id));
        } else {
            await this.pool.insert(BasemapRaster).values({
                basemap: base.id
            }).onConflictDoNothing();
            await this.pool.delete(BasemapTerrain).where(eq(BasemapTerrain.basemap, base.id));
            await this.pool.delete(BasemapVector).where(eq(BasemapVector.basemap, base.id));
        }

        return this.from(base.id);
    }

    async delete(id: number): Promise<void> {
        await super.delete(id);
    }

    async list(query: GenericListInput = {}): Promise<{ total: number, items: Array<any> }> {
        // Warning: This implementation of list does NOT join specific tables on listing for performance
        // This means specific fields like 'styles' won't be in the list view unless we do manual joins here
        // However, standard Model.list usually just queries the main table.
        // If the frontend needs specific fields in list, we might need to adjust.
        // For now, let's assume listing Basemaps only needs common fields.

        const pgres = await this.pool
            .select({
                count: sql<number>`count(*) OVER()`.as('count'),
                basemap: Basemap,
                vector: BasemapVector,
                terrain: BasemapTerrain,
                raster: BasemapRaster
            })
            .from(Basemap)
            .leftJoin(BasemapVector, eq(Basemap.id, BasemapVector.basemap))
            .leftJoin(BasemapTerrain, eq(Basemap.id, BasemapTerrain.basemap))
            .leftJoin(BasemapRaster, eq(Basemap.id, BasemapRaster.basemap))
            .where(query.where)
            .orderBy(query.order === 'desc' ? desc(sql.raw(query.sort === 'id' || !query.sort ? 'basemaps.id' : query.sort)) : sql.raw(query.sort === 'id' || !query.sort ? 'basemaps.id' : query.sort))
            .limit(query.limit || 10)
            .offset((query.page || 0) * (query.limit || 10))

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        }

        return {
            total: pgres[0].count,
            items: pgres.map((row) => {
                return {
                    ...row.vector,
                    ...row.terrain,
                    ...row.raster,
                    ...row.basemap,
                }
            })
        };
    }


    async collections(query: GenericListInput = {}): Promise<Array<Static<typeof BasemapCollection>>> {
        const pgres = await this.pool
            .select({
                name: Basemap.collection
            })
            .from(Basemap)
            .leftJoin(BasemapVector, eq(Basemap.id, BasemapVector.basemap))
            .leftJoin(BasemapTerrain, eq(Basemap.id, BasemapTerrain.basemap))
            .leftJoin(BasemapRaster, eq(Basemap.id, BasemapRaster.basemap))
            .where(query.where)
            .groupBy(Basemap.collection)
            .orderBy(desc(Basemap.collection))

        if (pgres.length === 0) {
            return [] as Array<Static<typeof BasemapCollection>>;
        } else {
            return pgres as Array<Static<typeof BasemapCollection>>;
        }
    }
}

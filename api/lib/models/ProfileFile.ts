import Err from '@openaddresses/batch-error'
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox'
import { ProfileFileResponse } from '../types.js'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfileFile, ProfileFileChannel } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

export default class ProfileFileModel extends Modeler<typeof ProfileFile> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, ProfileFile);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof ProfileFileResponse>> {
        const SubTable = this.pool
            .select({
                file: ProfileFileChannel.file,
                channels: sql`JSON_AGG(profile_file_channel.channel)`.as('channels')
            })
            .from(ProfileFileChannel)
            .groupBy(ProfileFileChannel.file)
            .as('channels');

        const pgres = await this.pool
            .select({
                file: ProfileFile,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels')
            })
            .from(ProfileFile)
            .leftJoin(SubTable, eq(ProfileFile.id, SubTable.file))
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].file,
            channels: pgres[0].channels
        } as Static<typeof ProfileFileResponse>;
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof ProfileFileResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                file: ProfileFileChannel.file,
                channels: sql`JSON_AGG(profile_file_channel.channel)`.as('channels')
            })
            .from(ProfileFileChannel)
            .groupBy(ProfileFileChannel.file)
            .as('channels');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                file: ProfileFile,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels')
            })
            .from(ProfileFile)
            .leftJoin(SubTable, eq(ProfileFile.id, SubTable.file))
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
                        ...t.file,
                        channels: t.channels,
                    } as Static<typeof ProfileFileResponse>
                })
            };
        }
    }
}

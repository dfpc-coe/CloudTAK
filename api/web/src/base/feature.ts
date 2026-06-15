/**
 * FeatureManager provides methods for managing Features in both the API
 * and the dexie database. It is designed implement BaseInterface and 
 * provides additional methods specific to the Feature entity, such as counting,
 * listing with filters, downloading, and deleting features.
 *
 * Note that it currently does not handle re-rendering calls in the map stack and therefore
 * must be used in conjunction with the cot.ts module or atlas-database.ts to ensure
 * that re-rendering is triggered.
 */

import { liveQuery, type Observable } from 'dexie';
import { db, type DBFeature } from '../database.ts';
import type { paths } from '@cloudtak/api-types';
import { server, downloadUrl } from '../std.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions,
    BaseInterface_FromOptions
} from './interface.ts';

type FeatureListQuery = NonNullable<paths['/api/profile/feature']['get']['parameters']['query']>;
type FeatureDeleteQuery = NonNullable<paths['/api/profile/feature']['delete']['parameters']['query']>;

export type Feature_ExportFormat = FeatureListQuery['format'];

export type Feature_ListOptions = BaseInterface_ListOptions & {
    path?: string;
    filter?: string;
};

export type Feature_FromOptions = BaseInterface_FromOptions;

export type Feature_DeleteOptions = {
    path?: FeatureDeleteQuery['path'];
    permanent?: FeatureDeleteQuery['permanent'];
};

export type Feature_DownloadOptions = {
    format?: Feature_ExportFormat;
};

export default class FeatureManager extends BaseInterface {
    static readonly listCacheKey = 'feature';

    static async count(): Promise<number> {
        return await db.feature.count();
    }

    static liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.feature.count();
        });
    }

    static liveList(): Observable<DBFeature[]> {
        return liveQuery(async () => {
            return await db.feature.toArray();
        });
    }

    static async list(opts: Feature_ListOptions = {}): Promise<DBFeature[]> {
        let collection = db.feature.toCollection();

        if (opts.path !== undefined) {
            collection = collection.filter((feat) => feat.path === opts.path);
        }

        if (opts.filter) {
            const filter = opts.filter.toLowerCase();
            collection = collection.filter((feat) => {
                const callsign = String(feat.properties.callsign ?? '').toLowerCase();
                return callsign.includes(filter);
            });
        }

        return await collection.toArray();
    }

    static async from(
        id: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        opts?: Feature_FromOptions
    ): Promise<DBFeature | undefined> {
        return await db.feature.get(id);
    }

    static liveFrom(id: string): Observable<DBFeature | undefined> {
        return liveQuery(async () => {
            return await db.feature.get(id);
        });
    }

    /**
     * Export the profile features from the server and trigger a browser download.
     *
     * @param opts.format - The export format to request (defaults to GeoJSON)
     */
    static async download(opts: Feature_DownloadOptions = {}): Promise<void> {
        const format = opts.format ?? 'geojson';

        await downloadUrl(`/api/profile/feature?format=${encodeURIComponent(format)}&download=true`, {
            token: true,
            filename: `download.${format}`
        });
    }

    /**
     * Delete profile features on the server.
     *
     * Without a `path`, all of the user's features are removed. By default features
     * are archived (soft deleted) unless `permanent` is set.
     */
    static async delete(opts: Feature_DeleteOptions = {}): Promise<void> {
        const res = await server.DELETE('/api/profile/feature', {
            params: {
                query: {
                    path: opts.path,
                    permanent: opts.permanent ?? false
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
    }
}

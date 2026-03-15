import type COT from '../base/cot.ts';
import type { Point, LineString } from 'geojson';
import type { InputFeature } from '../types.ts';
import type AtlasDatabase from './atlas-database.ts';
import { db } from '../base/database.ts';

export default class AtlasBreadcrumb {
    db: AtlasDatabase;

    // Tracks which CoT UIDs have live breadcrumb trail recording enabled
    enabled: Set<string>;
    // Buffers the first coordinate for a UID while waiting for the second to form a LineString
    pending: Map<string, number[]>;

    constructor(db: AtlasDatabase) {
        this.db = db;
        this.enabled = new Set();
        this.pending = new Map();
    }

    /**
     * Enable or disable live breadcrumb trail recording for a given CoT UID.
     * When enabled, each incoming Point position update for that UID will
     * incrementally extend a companion LineString stored under the ID
     * `<uid>.track`.
     *
     * @param uid     - The CoT UID to toggle
     * @param enabled - True to start recording, false to stop (trail is kept)
     */
    async set(uid: string, enabled: boolean): Promise<void> {
        if (enabled) {
            this.enabled.add(uid);
        } else {
            this.enabled.delete(uid);
            this.pending.delete(uid);
        }

        // Persist live state to DB so it survives page reloads
        const trackId = `${uid}.track`;
        const existing = await db.breadcrumb.get(trackId);
        if (existing) {
            await db.breadcrumb.put({ ...existing, live: enabled });
        }
    }

    /**
     * Remove a breadcrumb trail entirely and disable any future live updates.
     */
    async remove(uid: string): Promise<void> {
        this.enabled.delete(uid);
        this.pending.delete(uid);

        await db.breadcrumb.delete(`${uid}.track`);
    }

    /**
     * Returns whether live breadcrumb recording is currently enabled for the given UID
     */
    async get(uid: string): Promise<boolean> {
        return this.enabled.has(uid);
    }

    /**
     * Returns all CoT UIDs that currently have live breadcrumb recording enabled.
     * Queries the persistent Dexie store so the result survives page reloads.
     */
    async listEnabled(): Promise<string[]> {
        const rows = await db.breadcrumb.where('live').equals(1).toArray();
        return rows.map((r) => r.uid);
    }

    /**
     * On startup, restore all persisted breadcrumb LineStrings from Dexie
     * into the in-memory cots Map so they are rendered on the map.
     * Also restores the in-memory `enabled` Set from entries that have live: true.
     */
    async load(): Promise<void> {
        const all = await db.breadcrumb.toArray();

        for (const entry of all) {
            if (entry.live) {
                this.enabled.add(entry.uid);
            }

            if (entry.coordinates.length < 2) continue;

            const feature: InputFeature = this._buildFeature(
                entry.id,
                entry.uid,
                entry.path,
                entry.callsign,
                entry.coordinates,
                entry.color,
            );

            await this.db.add(feature, { skipSave: true });
        }
    }

    /**
     * Build the InputFeature used to add/update a breadcrumb in the cots Map.
     */
    private _buildFeature(
        id: string,
        uid: string,
        path: string,
        callsign: string,
        coordinates: number[][],
        color?: string,
    ): InputFeature {
        return {
            id,
            type: 'Feature',
            path,
            properties: {
                callsign: `${callsign} Track`,
                type: 'u-d-f-m',
                breadcrumb: true,
                uid,
                stroke: color || '#ff0000',
                'stroke-width': 2,
                'stroke-opacity': 1,
                'stroke-style': 'dashed',
            } as unknown as InputFeature['properties'],
            geometry: {
                type: 'LineString',
                coordinates,
            } as LineString,
        };
    }

    /**
     * Merge a set of historical coordinates into the `<uid>.track` LineString.
     * Historical coordinates are prepended so the trail reads oldest → newest.
     *
     * Handles both orderings:
     *
     * • History loaded first, live enabled later — no existing track yet.
     *   The history seeds the LineString. If live was already enabled and one
     *   position has been buffered in `pending` (waiting for a second coord to
     *   form the initial LineString) it is flushed to the end of the seed so it
     *   is not lost. Subsequent live positions are appended normally by update().
     *   Note: if significant time passes between the last historical position and
     *   the first live position the rendered trail will include a straight
     *   connecting line across that gap — a LineString cannot represent breaks.     *
     * • Live enabled first, history loaded later — existing track already
     *   contains live positions. History is prepended. Any single pending coord
     *   is never reachable here (the status of pending is irrelevant once a
     *   track LineString exists).
     *
     * @param uid         - The CoT UID whose trail should be updated
     * @param coordinates - Ordered array of [lng, lat] (or [lng, lat, alt]) positions
     */
    async merge(uid: string, coordinates: number[][]): Promise<void> {
        if (coordinates.length < 2) return;

        const trackId = `${uid}.track`;
        const existing = await db.breadcrumb.get(trackId);

        if (existing) {
            // Live trail already exists — prepend history before it
            const merged = [...coordinates, ...existing.coordinates];

            await db.breadcrumb.put({ ...existing, coordinates: merged });

            await this.db.add(
                this._buildFeature(trackId, uid, existing.path, existing.callsign, merged, existing.color),
                { skipSave: true },
            );
        } else {
            // No live trail yet — seed from history.
            // Flush any single buffered live coord so it is not silently dropped.
            const pendingCoord = this.pending.get(uid);
            const seedCoords = pendingCoord
                ? [...coordinates, pendingCoord]
                : coordinates;
            this.pending.delete(uid);

            const trackedCot = this.db.cots.get(uid);
            const callsign = trackedCot?.properties.callsign ?? uid;
            const path = trackedCot?.path ?? '/';
            const color = (trackedCot?.properties['marker-color'] as string | undefined) || undefined;

            await db.breadcrumb.put({
                id: trackId,
                uid,
                path,
                callsign,
                color,
                coordinates: seedCoords,
                live: this.enabled.has(uid),
            });

            await this.db.add(
                this._buildFeature(trackId, uid, path, callsign, seedCoords, color),
                { skipSave: true },
            );
        }
    }

    /**
     * Called after every add() to extend the breadcrumb LineString for a Point
     * feature whose UID is in `enabled`.
     */
    async update(cot: COT): Promise<void> {
        if (cot.geometry.type !== 'Point') return;
        if (!this.enabled.has(cot.id)) return;

        const coord = (cot.geometry as Point).coordinates;
        const breadcrumbId = `${cot.id}.track`;
        const existing = await db.breadcrumb.get(breadcrumbId);

        if (!existing) {
            const pendingCoord = this.pending.get(cot.id);

            if (!pendingCoord) {
                // Buffer the first position — we need at least two to form a LineString
                this.pending.set(cot.id, coord);
            } else {
                // We now have two distinct positions: create the LineString
                this.pending.delete(cot.id);
                const coordinates = [pendingCoord, coord];
                const color = (cot.properties['marker-color'] as string | undefined) || undefined;

                await db.breadcrumb.put({
                    id: breadcrumbId,
                    uid: cot.id,
                    path: cot.path,
                    callsign: cot.properties.callsign,
                    color,
                    coordinates,
                    live: true,
                });

                await this.db.add(
                    this._buildFeature(breadcrumbId, cot.id, cot.path, cot.properties.callsign, coordinates, color),
                    { skipSave: true },
                );
            }
        } else {
            // Append the new coordinate to the existing LineString
            const coordinates = [...existing.coordinates, coord];

            await db.breadcrumb.put({ ...existing, coordinates });

            await this.db.add(
                this._buildFeature(breadcrumbId, cot.id, existing.path, existing.callsign, coordinates, existing.color),
                { skipSave: true },
            );
        }
    }
}

import type { Response } from 'express';
import { createHash } from 'node:crypto';
import Err from '@openaddresses/batch-error';
import type { Static } from '@sinclair/typebox';
import Basemap from '../basemap.js';
import type { BasemapConfig, BasemapChildConfig } from '../basemap.js';
import type { Auth } from '../auth.js';
import TileCache from '../cache.js';
import { TileJSON } from '../tilejson.js';
import { BasemapProtocol, ResolvedTileOpts, assertTileSize } from './protocol.js';
import { fromProtocol } from './factory.js';
import {
    CACHE_CONTROL,
    CompositeSource,
    CompositeSpecType,
    compositeContentType,
    renderComposite,
    specHash,
    validateSpec,
} from '../composite.js';

/**
 * Composite basemap protocol.
 * Flattens an ordered stack of raster basemaps into a single tile with sharp.
 * The stored basemap carries the layer list; tilesize and format come from
 * the parent row. Children are resolved from the inline `children` the API
 * returned, falling back to a per-basemap lookup with the caller's token.
 */
export default class CompositeBasemap extends BasemapProtocol {
    spec(): CompositeSpecType {
        const layers = this.basemap.layers;

        if (!Array.isArray(layers) || !layers.length) {
            throw new Err(400, null, 'Composite basemap has no layers');
        }

        if (this.basemap.format === 'mvt') {
            throw new Err(400, null, 'Composite basemaps must use a raster format');
        }

        return validateSpec({
            tilesize: this.basemap.tilesize === 512 ? 512 : 256,
            format: this.basemap.format,
            layers,
        });
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: ResolvedTileOpts,
    ): Promise<void> {
        const spec = this.spec();

        const children = await CompositeBasemap.children(spec, {
            token: opts.token,
            inline: this.basemap.children,
        });

        return CompositeBasemap.render(z, x, y, res, spec, children, opts);
    }

    static assertChild(child: BasemapChildConfig): void {
        if (child.protocol === 'composite') {
            throw new Err(400, null, `Basemap ${child.id} is a composite and cannot be nested`);
        }

        if (child.type !== 'raster') {
            throw new Err(400, null, `Basemap ${child.id} is ${child.type} - composite layers must be raster`);
        }
    }

    /**
     * Resolve each layer's basemap in layer order, preferring children the API
     * returned inline so sharing tokens need no further lookups
     */
    static async children(
        spec: CompositeSpecType,
        opts: {
            token?: string;
            inline?: BasemapConfig['children'];
            auth?: Auth;
        },
    ): Promise<BasemapChildConfig[]> {
        const inline = new Map((opts.inline ?? []).map(child => [child.id, child]));

        return Promise.all(spec.layers.map(async (layer) => {
            let child = inline.get(layer.basemap);

            if (!child) {
                if (!opts.token) throw new Err(400, null, `Composite layer basemap ${layer.basemap} is not available`);

                const basemap = await Basemap.from(layer.basemap, opts.token);
                if (opts.auth) basemap.authorize(opts.auth);
                child = basemap.config;
            }

            CompositeBasemap.assertChild(child);

            return child;
        }));
    }

    static sources(children: BasemapChildConfig[], opts: ResolvedTileOpts): CompositeSource[] {
        return children.map((child) => {
            const protocol = fromProtocol(child);

            return {
                minzoom: child.minzoom ?? 0,
                maxzoom: child.maxzoom ?? 16,
                tile: (z, x, y) => protocol.buffer(z, x, y, { headers: opts.headers }),
            };
        });
    }

    /** Cache key input - the spec plus whatever identifies the children's current content */
    static hash(spec: CompositeSpecType, children: BasemapChildConfig[]): string {
        return specHash(spec, children.map(child => [child.id, child.url, child.updated]));
    }

    static async render(
        z: number, x: number, y: number,
        res: Response,
        spec: CompositeSpecType,
        children: BasemapChildConfig[],
        opts: ResolvedTileOpts,
    ): Promise<void> {
        const key = `composite/${CompositeBasemap.hash(spec, children)}/${z}/${x}/${y}.${spec.format}`;
        const cache = TileCache.shared();

        let data = await cache.get(key);

        if (!data) {
            data = await renderComposite(z, x, y, spec, CompositeBasemap.sources(children, opts));

            if (!data) {
                res.status(204).send('');
                return;
            }

            assertTileSize(data.byteLength);

            await cache.set(key, data);
        }

        res.writeHead(200, {
            'Content-Type': compositeContentType(spec.format),
            'Content-Length': data.byteLength,
            'Cache-Control': CACHE_CONTROL,
            'ETag': `"${createHash('sha256').update(data).digest('hex')}"`,
        });

        res.end(data);
    }

    /** TileJSON derived from the children - union bounds, widest zoom range, joined attribution */
    static tilejson(
        spec: CompositeSpecType,
        children: BasemapChildConfig[],
        url: string,
    ): Static<typeof TileJSON> {
        let bounds: number[] | undefined = [180, 90, -180, -90];
        for (const child of children) {
            if (!child.bounds || child.bounds.length !== 4) {
                bounds = undefined;
                break;
            }

            bounds = [
                Math.min(bounds[0], child.bounds[0]),
                Math.min(bounds[1], child.bounds[1]),
                Math.max(bounds[2], child.bounds[2]),
                Math.max(bounds[3], child.bounds[3]),
            ];
        }

        const attribution = [...new Set(children.map(child => child.attribution).filter(Boolean))].join(', ');

        return {
            ...BasemapProtocol.json({
                name: 'Composite',
                url,
                attribution: attribution || undefined,
                tilesize: spec.tilesize,
                bounds,
                minzoom: Math.min(...children.map(child => child.minzoom ?? 0)),
                maxzoom: Math.max(...children.map(child => child.maxzoom ?? 16)),
                type: 'raster',
            }),
            format: spec.format,
        };
    }
}

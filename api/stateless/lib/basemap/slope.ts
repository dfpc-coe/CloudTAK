import sharp from 'sharp';
import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import { fetch as typedFetch } from '@tak-ps/node-safeurl';
import type { Static } from '@sinclair/typebox';
import { BasemapProtocol, TileOpts } from '../interface-basemap.js';
import { BasemapTerrain_Encoding } from '../../../common/enums.js';
import type { TileJSON_Legend } from '../../../common/types.js';

const EARTH_CIRCUMFERENCE = 40075016.686;

// Parent zoom levels to walk up when the DEM has no tile at the requested zoom
const MAX_OVERZOOM = 4;

/**
 * Avalanche slope angle classes as [min degrees, RGBA]
 */
export const SLOPE_CLASSES: Array<[number, [number, number, number, number]]> = [
    [27, [255, 235, 59, 200]],
    [30, [255, 152, 0, 200]],
    [35, [244, 67, 54, 200]],
    [45, [156, 39, 176, 200]],
    [50, [33, 33, 33, 200]],
];

interface DEM {
    size: number;
    elevation: Float32Array;
}

/**
 * @class
 *
 * Slope Angle basemap protocol.
 * Fetches raster-dem tiles from a ZXY template and renders slope angle
 * classes as transparent PNG tiles.
 */
export default class SlopeBasemap extends BasemapProtocol {
    legend(): Static<typeof TileJSON_Legend> {
        return SLOPE_CLASSES.map(([min, [r, g, b, a]], i) => ({
            label: i < SLOPE_CLASSES.length - 1 ? `${min}-${SLOPE_CLASSES[i + 1][0]}°` : `${min}°+`,
            color: `rgba(${r}, ${g}, ${b}, ${Math.round(a / 255 * 100) / 100})`,
        }));
    }

    isValidURL(str: string): void {
        super.isValidURL(str);

        const pathname = decodeURIComponent(str).replace(/\{\$/g, '{');

        if (!(pathname.includes('{z}') && pathname.includes('{x}') && pathname.includes('{y}'))) {
            throw new Err(400, null, 'Slope protocol requires a raster-dem {z}/{x}/{y} tile URL');
        }
    }

    static decode(data: Uint8Array, channels: number, size: number, encoding: BasemapTerrain_Encoding): Float32Array {
        const elevation = new Float32Array(size * size);

        for (let i = 0; i < elevation.length; i++) {
            const r = data[i * channels];
            const g = data[i * channels + 1];
            const b = data[i * channels + 2];

            elevation[i] = encoding === BasemapTerrain_Encoding.TERRARIUM
                ? (r * 256 + g + b / 256) - 32768
                : -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
        }

        return elevation;
    }

    /**
     * Slope in degrees for every pixel using Horn's method, with edge pixels clamped
     */
    static slope(dem: DEM, z: number, y: number): Float32Array {
        const { size, elevation } = dem;
        const slope = new Float32Array(size * size);

        const at = (px: number, py: number): number => {
            return elevation[Math.min(Math.max(py, 0), size - 1) * size + Math.min(Math.max(px, 0), size - 1)];
        };

        for (let py = 0; py < size; py++) {
            const n = Math.PI - (2 * Math.PI * (y + (py + 0.5) / size)) / 2 ** z;
            const lat = Math.atan(Math.sinh(n));
            const cell = (EARTH_CIRCUMFERENCE * Math.cos(lat)) / (2 ** z * size);

            for (let px = 0; px < size; px++) {
                const a = at(px - 1, py - 1), b = at(px, py - 1), c = at(px + 1, py - 1);
                const d = at(px - 1, py), f = at(px + 1, py);
                const g = at(px - 1, py + 1), h = at(px, py + 1), i = at(px + 1, py + 1);

                const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cell);
                const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cell);

                slope[py * size + px] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180 / Math.PI;
            }
        }

        return slope;
    }

    static colorize(slope: Float32Array): Buffer {
        const rgba = Buffer.alloc(slope.length * 4);

        for (let i = 0; i < slope.length; i++) {
            for (let c = SLOPE_CLASSES.length - 1; c >= 0; c--) {
                if (slope[i] >= SLOPE_CLASSES[c][0]) {
                    rgba.set(SLOPE_CLASSES[c][1], i * 4);
                    break;
                }
            }
        }

        return rgba;
    }

    private tileURL(z: number, x: number, y: number): URL {
        return new URL(this.basemap!.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y)));
    }

    /**
     * Fetch the DEM for a tile, upsampling a parent tile when the source has no data at this zoom
     */
    private async dem(z: number, x: number, y: number, headers: Record<string, string>): Promise<DEM | null> {
        const encoding = (this.basemap as { encoding?: BasemapTerrain_Encoding }).encoding ?? BasemapTerrain_Encoding.MAPBOX;

        for (let dz = 0; dz <= Math.min(MAX_OVERZOOM, z); dz++) {
            const res = await typedFetch(this.tileURL(z - dz, x >> dz, y >> dz), { headers });

            if (res.status === 404 || res.status === 204) continue;
            if (!res.ok) throw new Err(400, null, `Upstream Error: ${res.status} ${res.statusText}`);

            const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            if (info.width !== info.height) throw new Err(400, null, 'DEM tiles must be square');

            const dem = { size: info.width, elevation: SlopeBasemap.decode(data, info.channels, info.width, encoding) };

            return dz === 0 ? dem : SlopeBasemap.upsample(dem, dz, x, y);
        }

        return null;
    }

    /**
     * Bilinearly resample the quadrant of a parent DEM covering a tile dz levels below it
     */
    static upsample(parent: DEM, dz: number, x: number, y: number): DEM {
        const { size } = parent;
        const scale = 2 ** dz;
        const elevation = new Float32Array(size * size);

        const at = (px: number, py: number): number => {
            return parent.elevation[Math.min(Math.max(py, 0), size - 1) * size + Math.min(Math.max(px, 0), size - 1)];
        };

        for (let py = 0; py < size; py++) {
            const sy = ((y % scale) + (py + 0.5) / size) * size / scale - 0.5;
            const y0 = Math.floor(sy);
            const fy = sy - y0;

            for (let px = 0; px < size; px++) {
                const sx = ((x % scale) + (px + 0.5) / size) * size / scale - 0.5;
                const x0 = Math.floor(sx);
                const fx = sx - x0;

                elevation[py * size + px] = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy)
                    + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
            }
        }

        return { size, elevation };
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        try {
            const dem = await this.dem(z, x, y, opts.headers as Record<string, string>);

            if (!dem) {
                res.status(404).send('Tile not found');
                return;
            }

            const tile = await sharp(SlopeBasemap.colorize(SlopeBasemap.slope(dem, z, y)), {
                raw: { width: dem.size, height: dem.size, channels: 4 },
            }).png({ palette: true }).toBuffer();

            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': Buffer.byteLength(tile),
                'Cache-Control': 'public, max-age=86400',
            });

            res.write(tile);
            res.end();
        } catch (err) {
            if (err instanceof Err) {
                throw err;
            } else {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to render slope tile');
            }
        }
    }
}

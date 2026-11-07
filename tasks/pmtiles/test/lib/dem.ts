import { Tile, Terrain } from '@tak-ps/node-tiles';
import type { TerrainEncoding } from '@tak-ps/node-tiles';
import { encodePNG } from '@tak-ps/node-tiles/node';

export interface DemTileOptions {
    tile?: Tile;
    size?: number;
    encoding?: TerrainEncoding;
}

/** A square raster-dem PNG holding a constant elevation or one computed per pixel */
export async function demTile(
    elevation: number | ((px: number, py: number) => number),
    opts: DemTileOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
    const size = opts.size ?? 4;
    const grid = new Float32Array(size * size);

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            grid[py * size + px] = typeof elevation === 'number' ? elevation : elevation(px, py);
        }
    }

    const terrain = new Terrain(opts.tile ?? new Tile(0, 0, 0), size, grid);
    return new Uint8Array(await encodePNG(terrain.encode(opts.encoding ?? 'mapbox')));
}

/** Elevation function for a plane rising eastward at `degrees` across `tile` */
export function plane(degrees: number, tile: Tile, size: number): (px: number, py: number) => number {
    const rise = Math.tan(degrees * Math.PI / 180);
    return (px, py) => 1000 + px * tile.resolution(py, size) * rise;
}

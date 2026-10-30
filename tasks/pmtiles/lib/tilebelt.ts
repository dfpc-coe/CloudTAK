import type { BBox } from 'geojson';

const r2d = 180 / Math.PI;

export type Tile = [number, number, number];

function tile2lon(x: number, z: number): number {
    return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return r2d * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileToBBOX(tile: Tile): BBox {
    const e = tile2lon(tile[0] + 1, tile[2]);
    const w = tile2lon(tile[0], tile[2]);
    const s = tile2lat(tile[1] + 1, tile[2]);
    const n = tile2lat(tile[1], tile[2]);
    return [w, s, e, n];
}

import type { Feature, FeatureCollection, Geometry } from 'geojson';

export type F = Feature<Geometry | null>;
export type FC = FeatureCollection<Geometry | null>;

export interface KmlOptions {
    skipNullGeometry?: boolean;
}

export interface Folder {
    type: 'folder';
    meta: Record<string, unknown>;
    children: Array<Folder | F>;
}

export interface Root {
    type: 'root';
    children: Array<Folder | F>;
}

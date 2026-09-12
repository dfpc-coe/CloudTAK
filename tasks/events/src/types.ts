import type { paths } from '@cloudtak/api-types';

export type AssetNode = {
    name: string;
    path: string;
    ext: string;
    children?: AssetNode[];
};

export type ConvertResponse = {
    asset: string;
    children?: AssetNode[];
    icons?: Set<{
        name: string;
        data: string;
    }>;
};

export interface Transform {
    convert(): Promise<ConvertResponse>;
}

export type Message = {
    api: string;
    bucket: string;
    secret: string;
    job: Import;
};

export type LocalMessage = {
    id: string;
    tmpdir: string;
    ext: string;
    name: string;
    raw: string;
};

export type ImportList = paths['/api/import']['get']['responses']['200']['content']['application/json'];
export type Import = paths['/api/import/{:import}']['get']['responses']['200']['content']['application/json'];
export type Asset = paths['/api/profile/asset']['post']['responses']['200']['content']['application/json'];
export type Basemap = paths['/api/basemap']['post']['responses']['200']['content']['application/json'];
export type ProfileFeature = paths['/api/profile/feature']['put']['responses']['200']['content']['application/json'];

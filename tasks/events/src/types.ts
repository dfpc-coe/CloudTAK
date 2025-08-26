import type { paths } from './derived-types.js';

export type Message = {
    api: string
    bucket: string
    secret: string
    job: Import
};

export type LocalMessage = {
    tmpdir: string;
    ext: string;
    name: string;
    raw: string;
}

export type ImportList = paths["/api/import"]["get"]["responses"]["200"]["content"]["application/json"]
export type Import = paths["/api/import/{:import}"]["get"]["responses"]["200"]["content"]["application/json"]
export type Asset = paths["/api/profile/asset"]["post"]["responses"]["200"]["content"]["application/json"]

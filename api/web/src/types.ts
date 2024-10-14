import type { paths } from './derived-types.js';

/*
 * This file exports more human managable types from the
 * automatically generated dervice-types.d.ts file
 */

export type APIError = {
    status: number;
    message: string;
};

export type APIList<T> = {
    total: number;
    items: Array<T>;
}

export type VideoLease = paths["/video/lease/{:lease}"]["get"]["responses"]["200"]["content"]["application/json"];

export type Group = paths["/marti/group"]["get"]["responses"]["200"]["content"]["application/json"]["data"][0]

export type Mission = paths["/marti/missions/{:name}"]["get"]["responses"]["200"]["content"]["application/json"];
export type MissionLog = paths["/marti/missions/{:name}/log/{:logid}"]["patch"]["responses"]["200"]["content"]["application/json"]["data"];
export type MissionLogList = paths["/marti/missions/{:name}/log"]["get"]["responses"]["200"]["content"]["application/json"];

export type Server_Update = paths["/server"]["patch"]["requestBody"]["content"]["application/json"]
export type Server = paths["/server"]["get"]["responses"]["200"]["content"]["application/json"]

export type Login = paths["/login"]["get"]["responses"]["200"]["content"]["application/json"]

export type Profile = paths["/profile"]["get"]["responses"]["200"]["content"]["application/json"]
export type Profile_Update = paths["/profile"]["patch"]["requestBody"]["content"]["application/json"]

export type Basemap = paths["/basemap/{:basemapid}"]["patch"]["responses"]["200"]["content"]["application/json"]

export type Feature = paths["/profile/feature/{:id}"]["get"]["responses"]["200"]["content"]["application/json"] & {
    properties: {
        'id': string;
        'icon-opacity'?: number;
        'circle-opacity'?: number;

        [index: string]: unknown
    }
}

export type ProfileOverlay = paths["/profile/overlay/{:overlay}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileOverlay_Create = paths["/profile/overlay"]["post"]["requestBody"]["content"]["application/json"]
export type ProfileOverlay_Update = paths["/profile/overlay/{:overlay}"]["patch"]["requestBody"]["content"]["application/json"]

import type { paths } from './derived-types.js';

/*
 * This file exports more human managable types from the
 * automatically generated dervice-types.d.ts file
 */

export type APIError = {
    status: number;
    message: string;
};

export type Profile = paths["/profile"]["get"]["responses"]["200"]["content"]["application/json"]
export type Profile_Update = paths["/profile"]["patch"]["requestBody"]["content"]["application/json"]

export type Basemap = paths["/basemap/{:basemapid}"]["patch"]["responses"]["200"]["content"]["application/json"]

export type Feature = paths["/profile/feature/{:id}"]["get"]["responses"]["200"]["content"]["application/json"]

export type ProfileOverlay = paths["/profile/overlay/{:overlay}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileOverlay_Create = paths["/profile/overlay"]["post"]["requestBody"]["content"]["application/json"]
export type ProfileOverlay_Update = paths["/profile/overlay/{:overlay}"]["patch"]["requestBody"]["content"]["application/json"]

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
export type Basemap = paths["/basemap/{:basemapid}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileOverlay = paths["/profile/overlay/{:overlay}"]["get"]["responses"]["200"]["content"]["application/json"]

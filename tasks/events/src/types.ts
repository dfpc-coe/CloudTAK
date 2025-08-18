import type { paths } from './derived-types.js';

export type ImportList = paths["/api/import"]["get"]["responses"]["200"]["content"]["application/json"]
export type Import = paths["/api/import/{:import}"]["get"]["responses"]["200"]["content"]["application/json"]

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

// Below are TAK/CloudTAK Specific Data Types

export type COTType = paths["/type/cot/{:type}"]["get"]["responses"]["200"]["content"]["application/json"];

export type SearchSuggest = paths["/search/suggest"]["get"]["responses"]["200"]["content"]["application/json"];
export type SearchForward = paths["/search/forward"]["get"]["responses"]["200"]["content"]["application/json"];

export type VideoLease = paths["/video/lease/{:lease}"]["get"]["responses"]["200"]["content"]["application/json"]["lease"];
export type VideoLeaseList = paths["/video/lease"]["get"]["responses"]["200"]["content"]["application/json"];
export type VideoLeaseProtocols = paths["/video/lease/{:lease}"]["get"]["responses"]["200"]["content"]["application/json"]["protocols"];
export type VideoLeaseResponse = paths["/video/lease/{:lease}"]["get"]["responses"]["200"]["content"]["application/json"]

export type Subscription = paths["/marti/subscription/{:clientuid}"]["get"]["responses"]["200"]["content"]["application/json"];

export type Group = paths["/marti/group"]["get"]["responses"]["200"]["content"]["application/json"]["data"][0]

export type User = paths["/user/{:username}"]["get"]["responses"]["200"]["content"]["application/json"];
export type UserList = paths["/user"]["get"]["responses"]["200"]["content"]["application/json"];

export type Contact = paths["/marti/api/contacts/all"]["get"]["responses"]["200"]["content"]["application/json"][0];
export type ContactList = paths["/marti/api/contacts/all"]["get"]["responses"]["200"]["content"]["application/json"];

export type Content = paths["/marti/package"]["put"]["responses"]["200"]["content"]["application/json"];

export type VideoConnection = paths["/marti/video/{:uid}"]["get"]["responses"]["200"]["content"]["application/json"];
export type VideoConnectionFeed = paths["/marti/video/{:uid}"]["get"]["responses"]["200"]["content"]["application/json"]["feeds"][0];
export type VideoConnection_Create = paths["/marti/video"]["post"]["requestBody"]["content"]["application/json"];
export type VideoConnectionList = paths["/marti/video"]["get"]["responses"]["200"]["content"]["application/json"];

export type Mission = paths["/marti/missions/{:name}"]["get"]["responses"]["200"]["content"]["application/json"];
export type Mission_Create = paths["/marti/missions/{:name}"]["post"]["requestBody"]["content"]["application/json"]
export type MissionList = paths["/marti/mission"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionRole = paths["/marti/missions/{:name}/role"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionLog = paths["/marti/missions/{:name}/log/{:logid}"]["patch"]["responses"]["200"]["content"]["application/json"]["data"];
export type MissionLogList = paths["/marti/missions/{:name}/log"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionLayer = paths["/marti/missions/{:name}/layer/{:layerid}"]["get"]["responses"]["200"]["content"]["application/json"]["data"];
export type MissionLayerList = paths["/marti/missions/{:name}/layer"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionChanges = paths["/marti/missions/{:name}/changes"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionSubscriptions = paths["/marti/missions/{:name}/subscriptions/roles"]["get"]["responses"]["200"]["content"]["application/json"]["data"];

export type Server_Update = paths["/server"]["patch"]["requestBody"]["content"]["application/json"]
export type Server = paths["/server"]["get"]["responses"]["200"]["content"]["application/json"]

export type Login = paths["/login"]["get"]["responses"]["200"]["content"]["application/json"]
export type Login_Create = paths["/login"]["post"]["requestBody"]["content"]["application/json"]
export type Login_CreateRes = paths["/login"]["post"]["responses"]["200"]["content"]["application/json"]

export type Import = paths["/import/{:import}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ImportBatch = paths["/import/{:import}/batch"]["get"]["responses"]["200"]["content"]["application/json"]
export type ImportList = paths["/import"]["get"]["responses"]["200"]["content"]["application/json"]

export type Profile = paths["/profile"]["get"]["responses"]["200"]["content"]["application/json"]
export type Profile_Update = paths["/profile"]["patch"]["requestBody"]["content"]["application/json"]

export type Package = paths["/marti/package/{:uid}"]["get"]["responses"]["200"]["content"]["application/json"]
export type PackageList = paths["/marti/package"]["get"]["responses"]["200"]["content"]["application/json"]

export type IconsetList = paths["/iconset"]["get"]["responses"]["200"]["content"]["application/json"]

export type ConfigGroups = paths["/config/group"]["get"]["responses"]["200"]["content"]["application/json"]

export type Basemap = paths["/basemap/{:basemapid}"]["patch"]["responses"]["200"]["content"]["application/json"]
export type BasemapList = paths["/basemap"]["get"]["responses"]["200"]["content"]["application/json"]

export type Feature = paths["/profile/feature/{:id}"]["get"]["responses"]["200"]["content"]["application/json"] & {
    properties: {
        'id': string;
        'icon-opacity'?: number;
        'circle-opacity'?: number;

        [index: string]: unknown
    }
}

export type FeatureCollection = {
    type: string
    features: Array<Feature>
};

export type ProfileOverlay = paths["/profile/overlay/{:overlay}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileOverlay_Create = paths["/profile/overlay"]["post"]["requestBody"]["content"]["application/json"]
export type ProfileOverlay_Update = paths["/profile/overlay/{:overlay}"]["patch"]["requestBody"]["content"]["application/json"]

export type SearchReverse = paths["/search/reverse/{:longitude}/{:latitude}"]["get"]["responses"]["200"]["content"]["application/json"]

// Below are CloudTAK ETL Specific Data Types

export type ETLConnectionList = paths["/connection"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLConnection = paths["/connection/{:connectionid}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLConnectionSink = paths["/connection/{:connectionid}/sink/{:sinkid}"]["get"]["responses"]["200"]["content"]["application/json"]

export type ETLConnectionAssetList = paths["/connection/{:connectionid}/asset"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLAgency = paths["/agency/{:agencyid}"]["get"]["responses"]["200"]["content"]["application/json"]

export type ETLLayer = paths["/connection/{:connectionid}/layer/{:layerid}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLLayerIncoming = paths["/connection/{:connectionid}/layer/{:layerid}/incoming"]["post"]["responses"]["200"]["content"]["application/json"]

export type ETLData = paths["/connection/{:connectionid}/data/{:dataid}"]["get"]["responses"]["200"]["content"]["application/json"]

export type VideoService = paths["/video/service"]["get"]["responses"]["200"]["content"]["application/json"];
export type VideoServer = paths["/video/server"]["post"]["responses"]["200"]["content"]["application/json"];
export type VideoServerList = paths["/video/server"]["get"]["responses"]["200"]["content"]["application/json"];

// Pattern properties are not yet supported
export type ETLRawTaskList = {
    total: number;
    items: Record<string, string[]>
}

export type ETLTaskVersions = paths["/task/raw/{:task}"]["get"]["responses"]["200"]["content"]["application/json"]


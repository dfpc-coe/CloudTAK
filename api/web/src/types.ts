import type { paths } from './derived-types.js';
import type { Origin } from './base/cot.ts'

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

export type COTTypeList = paths["/api/type/cot"]["get"]["responses"]["200"]["content"]["application/json"];
export type COTType = paths["/api/type/cot/{:type}"]["get"]["responses"]["200"]["content"]["application/json"];

export type Search = paths["/api/search"]["get"]["responses"]["200"]["content"]["application/json"];
export type SearchSuggest = paths["/api/search/suggest"]["get"]["responses"]["200"]["content"]["application/json"];
export type SearchForward = paths["/api/search/forward"]["get"]["responses"]["200"]["content"]["application/json"];

export type VideoLease = paths["/api/video/lease/{:lease}"]["get"]["responses"]["200"]["content"]["application/json"]["lease"];
export type VideoLeaseList = paths["/api/video/lease"]["get"]["responses"]["200"]["content"]["application/json"];
export type VideoLeaseProtocols = paths["/api/video/lease/{:lease}"]["get"]["responses"]["200"]["content"]["application/json"]["protocols"];
export type VideoLeaseResponse = paths["/api/video/lease/{:lease}"]["get"]["responses"]["200"]["content"]["application/json"]

export type Subscription = paths["/api/marti/subscription/{:clientuid}"]["get"]["responses"]["200"]["content"]["application/json"];

export type Group = paths["/api/marti/group"]["get"]["responses"]["200"]["content"]["application/json"]["data"][0]

export type User = paths["/api/user/{:username}"]["get"]["responses"]["200"]["content"]["application/json"];
export type UserList = paths["/api/user"]["get"]["responses"]["200"]["content"]["application/json"];

export type Contact = paths["/api/marti/api/contacts/all"]["get"]["responses"]["200"]["content"]["application/json"][0];
export type ContactList = paths["/api/marti/api/contacts/all"]["get"]["responses"]["200"]["content"]["application/json"];

export type Content = paths["/api/marti/package"]["put"]["responses"]["200"]["content"]["application/json"];

export type VideoConnection = paths["/api/marti/video/{:uid}"]["get"]["responses"]["200"]["content"]["application/json"];
export type VideoConnectionFeed = paths["/api/marti/video/{:uid}"]["get"]["responses"]["200"]["content"]["application/json"]["feeds"][0];
export type VideoConnection_Create = paths["/api/marti/video"]["post"]["requestBody"]["content"]["application/json"];
export type VideoConnectionList = paths["/api/marti/video"]["get"]["responses"]["200"]["content"]["application/json"];

export type Mission = paths["/api/marti/missions/{:name}"]["get"]["responses"]["200"]["content"]["application/json"];
export type Mission_Create = paths["/api/marti/missions"]["post"]["requestBody"]["content"]["application/json"]
export type MissionList = paths["/api/marti/mission"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionRole = paths["/api/marti/missions/{:name}/role"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionLog = paths["/api/marti/missions/{:name}/log/{:logid}"]["patch"]["responses"]["200"]["content"]["application/json"]["data"];
export type MissionLogList = paths["/api/marti/missions/{:name}/log"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionLayer = paths["/api/marti/missions/{:name}/layer/{:layerid}"]["get"]["responses"]["200"]["content"]["application/json"]["data"];
export type MissionLayer_Create = paths["/api/marti/missions/{:name}/layer"]["post"]["requestBody"]["content"]["application/json"];
export type MissionLayer_Update = paths["/api/marti/missions/{:name}/layer/{:uid}"]["patch"]["requestBody"]["content"]["application/json"];
export type MissionLayerList = paths["/api/marti/missions/{:name}/layer"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionChanges = paths["/api/marti/missions/{:name}/changes"]["get"]["responses"]["200"]["content"]["application/json"];

export type MissionSubscriptions = paths["/api/marti/missions/{:name}/subscriptions/roles"]["get"]["responses"]["200"]["content"]["application/json"]["data"];

export type Server_Update = paths["/api/server"]["patch"]["requestBody"]["content"]["application/json"]
export type Server = paths["/api/server"]["get"]["responses"]["200"]["content"]["application/json"]

export type MapConfig = paths["/api/config/map"]["get"]["responses"]["200"]["content"]["application/json"]

export type Login = paths["/api/login"]["get"]["responses"]["200"]["content"]["application/json"]
export type LoginConfig = paths["/api/config/login"]["get"]["responses"]["200"]["content"]["application/json"]
export type Login_Create = paths["/api/login"]["post"]["requestBody"]["content"]["application/json"]
export type Login_CreateRes = paths["/api/login"]["post"]["responses"]["200"]["content"]["application/json"]

export type Import = paths["/api/import/{:import}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ImportList = paths["/api/import"]["get"]["responses"]["200"]["content"]["application/json"]

export type Package = paths["/api/marti/package/{:uid}"]["get"]["responses"]["200"]["content"]["application/json"]
export type PackageList = paths["/api/marti/package"]["get"]["responses"]["200"]["content"]["application/json"]

export type IconsetList = paths["/api/iconset"]["get"]["responses"]["200"]["content"]["application/json"]

export type AttachmentList = paths["/api/attachment"]["get"]["responses"]["200"]["content"]["application/json"]
export type Attachment = paths["/api/attachment"]["get"]["responses"]["200"]["content"]["application/json"]["items"][0]

export type ConfigGroups = paths["/api/config/group"]["get"]["responses"]["200"]["content"]["application/json"]

export type TileJSON = paths["/api/basemap/{:basemapid}/tiles"]["get"]["responses"]["200"]["content"]["application/json"]

export type Basemap = paths["/api/basemap/{:basemapid}"]["patch"]["responses"]["200"]["content"]["application/json"]
export type BasemapList = paths["/api/basemap"]["get"]["responses"]["200"]["content"]["application/json"]

export type Palette = paths["/api/palette/{:palette}"]["get"]["responses"]["200"]["content"]["application/json"]
export type PaletteList = paths["/api/palette"]["get"]["responses"]["200"]["content"]["application/json"]
export type PaletteFeature = paths["/api/palette/{:palette}/feature/{:feature}"]["get"]["responses"]["200"]["content"]["application/json"]

export type Profile = paths["/api/profile"]["get"]["responses"]["200"]["content"]["application/json"]
export type Profile_Update = paths["/api/profile"]["patch"]["requestBody"]["content"]["application/json"]

export type ProfileChatroomList = paths["/api/profile/chatroom"]["get"]["responses"]["200"]["content"]["application/json"]

export type ProfileVideoList = paths["/api/profile/video"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileVideo = paths["/api/profile/video/{:id}"]["get"]["responses"]["200"]["content"]["application/json"]

export type ProfileFileList = paths["/api/profile/asset"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileFile = ProfileFileList["items"][0];

export type Feature = paths["/api/profile/feature/{:id}"]["get"]["responses"]["200"]["content"]["application/json"] & {
    origin?: Origin
    properties: {
        'id': string;
        'icon-opacity'?: number;
        'circle-opacity'?: number;

        [index: string]: unknown
    }
}

export type InputFeature = paths["/api/profile/feature/{:id}"]["get"]["responses"]["200"]["content"]["application/json"] & {
    origin?: Origin
    properties: {
        'id'?: string;
        'icon-opacity'?: number;
        'circle-opacity'?: number;

        [index: string]: unknown
    }
}

export type FeaturePropertyCreator = Exclude<Feature["properties"]["creator"], undefined>

export type FeatureCollection = {
    type: string
    features: Array<Feature>
};

export type ProfileOverlay = paths["/api/profile/overlay/{:overlay}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileOverlayList = paths["/api/profile/overlay"]["get"]["responses"]["200"]["content"]["application/json"]
export type ProfileOverlay_Create = paths["/api/profile/overlay"]["post"]["requestBody"]["content"]["application/json"]
export type ProfileOverlay_Update = paths["/api/profile/overlay/{:overlay}"]["patch"]["requestBody"]["content"]["application/json"]

export type SearchReverse = paths["/api/search/reverse/{:longitude}/{:latitude}"]["get"]["responses"]["200"]["content"]["application/json"]

// Below are CloudTAK ETL Specific Data Types

export type ETLLdapChannel = paths["/api/ldap/channel"]["get"]["responses"]["200"]["content"]["application/json"]["items"][0]
export type ETLLdapChannelList = paths["/api/ldap/channel"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLLdapUser = paths["/api/ldap/user"]["post"]["responses"]["200"]["content"]["application/json"]

export type ETLConnectionList = paths["/api/connection"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLConnection = paths["/api/connection/{:connectionid}"]["get"]["responses"]["200"]["content"]["application/json"]

export type ETLConnectionVideoLeaseList = paths["/api/connection/{:connectionid}/video/lease"]["get"]["responses"]["200"]["content"]["application/json"];

export type ETLConnectionToken = paths["/api/connection/{:connectionid}/token"]["get"]["responses"]["200"]["content"]["application/json"]["items"][0]
export type ETLConnectionTokenList = paths["/api/connection/{:connectionid}/token"]["get"]["responses"]["200"]["content"]["application/json"]

export type ETLConnectionAssetList = paths["/api/connection/{:connectionid}/asset"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLAgencyList = paths["/api/agency"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLAgency = paths["/api/agency/{:agencyid}"]["get"]["responses"]["200"]["content"]["application/json"]

export type ETLLayer = paths["/api/connection/{:connectionid}/layer/{:layerid}"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLLayerList = paths["/api/connection/{:connectionid}/layer"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLLayerAlertList = paths["/api/connection/{:connectionid}/layer/{:layerid}/alert"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLLayerTask = paths["/api/connection/{:connectionid}/layer/{:layerid}/task"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLLayerTaskCapabilities = paths["/api/connection/{:connectionid}/layer/{:layerid}/task/capabilities"]["get"]["responses"]["200"]["content"]["application/json"]
export type ETLLayerIncoming = paths["/api/connection/{:connectionid}/layer/{:layerid}/incoming"]["post"]["responses"]["200"]["content"]["application/json"]
export type ETLLayerOutgoing = paths["/api/connection/{:connectionid}/layer/{:layerid}/outgoing"]["post"]["responses"]["200"]["content"]["application/json"]

export type ETLData = paths["/api/connection/{:connectionid}/data/{:dataid}"]["get"]["responses"]["200"]["content"]["application/json"]

export type VideoService = paths["/api/video/service"]["get"]["responses"]["200"]["content"]["application/json"];

export type InjectorList = paths["/api/server/injector"]["get"]["responses"]["200"]["content"]["application/json"];
export type Injector = paths["/api/server/injector"]["get"]["responses"]["200"]["content"]["application/json"]["items"][0];

export type RepeaterList = paths["/api/server/repeater"]["get"]["responses"]["200"]["content"]["application/json"];
export type Repeater = paths["/api/server/repeater"]["get"]["responses"]["200"]["content"]["application/json"]["items"][0];

// Pattern properties are not yet supported
export type ETLRawTaskList = {
    total: number;
    items: Record<string, string[]>
}

export type ETLTaskVersions = paths["/api/task/raw/{:task}"]["get"]["responses"]["200"]["content"]["application/json"]


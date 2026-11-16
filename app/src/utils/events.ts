import type { Feature } from '../types.ts';

export enum WorkerMessageType {
    Atlas_Ready = 'cloudtak:atlas:ready',

    Map_FlyTo = 'cloudtak:map:flyto',
    Map_FitBounds = 'cloudtak:map:fitbounds',
    Map_Projection = 'cloudtak:map:projection',

    Profile_Callsign = 'cloudtak:profile:callsign',
    Profile_Display_Zoom = 'cloudtak:profile:display:zoom',

    Profile_Icon_Rotation = 'cloudtak:profile:icon:rotation',

    Profile_Distance_Unit = 'cloudtak:profile:distance:unit',
    Profile_Elevation_Unit = 'cloudtak:profile:elevation:unit',
    Profile_Speed_Unit = 'cloudtak:profile:speed:unit',

    Profile_Location_Coordinates = 'cloudtak:profile:location:coordinates',
    Profile_Location_Source = 'cloudtak:profile:location:source',

    // A local CoT edit is in memory - diff it onto the map now rather than
    // waiting for the refresh timer or for the edit to be persisted
    Feature_Render = 'cloudtak:feature:render',

    Feature_Archived_Added = 'cloudtak:feature:archived:added',
    Feature_Archived_Removed = 'cloudtak:feature:archived:removed',

    Channels_None = 'channels:none',
    Channels_List = 'channels:list',

    Connection_Open = 'connection:open',
    Connection_Close = 'connection:close',
    Connection_AuthFailure = 'connection:authfailure',
    Connection_Revoked = 'connection:revoked',

    Mission_Change_Feature = 'mission:change:feature',
    // A local Mission feature edit, drawn straight onto the overlay before it
    // is persisted - see MissionRenderFeatureBody for the payload
    Mission_Render_Feature = 'mission:render:feature',
    // TAK Server 5.9+ Mission Property (key/value) set or removed - see
    // MissionChangePropertyBody for the payload
    Mission_Change_Property = 'mission:change:property',
    Mission_Invite = 'mission:invite',

    Channel_Change = 'channel:change',

    Feature_Update = 'cloudtak:feature:update',
    History_Change = 'cloudtak:history:change',
    Profile_Update = 'cloudtak:profile:update',

    Sync_Start = 'cloudtak:sync:start',
    Sync_Complete = 'cloudtak:sync:complete',
    // Connectivity was restored (device network or TAK socket) - consumers
    // holding deferred work should retry now
    Sync_Trigger = 'cloudtak:sync:trigger',

    // Device network status forwarded from the main thread
    Network_Change = 'cloudtak:network:change',

    Iconset_Change = 'cloudtak:iconset:change',

    Tiles_Downloaded = 'cloudtak:tiles:downloaded',
    Tiles_Removed = 'cloudtak:tiles:removed',

    VideoWall_Ping = 'cloudtak:videowall:ping',
    VideoWall_Pong = 'cloudtak:videowall:pong',
    VideoWall_Refresh = 'cloudtak:videowall:refresh',
}

export type MissionRenderFeatureBody = {
    guid: string;
    // Feature to add or replace on the overlay, as Mission features are rendered
    add?: Feature;
    // Feature id to take off the overlay
    remove?: string;
};

/** Local Mission edits drawn on the overlay ahead of their IndexedDB write */
export type MissionPendingEdits = {
    add: Feature[];
    remove: string[];
};

export type MissionChangePropertyBody = {
    guid: string;
    name?: string;
    changes: Array<{
        type: 'ADD_CONTENT' | 'REMOVE_CONTENT' | string;
        key: string;
        value: string;
        creatorUid: string;
        timestamp: string;
    }>;
};

export type SyncTriggerReason = 'network' | 'connection';

export type SyncTriggerBody = {
    reason: SyncTriggerReason;
};

export type NetworkChangeBody = {
    online: boolean;
};

/** Trails whose history points or metadata changed; `all` means start over */
export type HistoryChangeBody = {
    uids: string[];
    removed: string[];
    all?: boolean;
};

export type WorkerMessage = {
    type: WorkerMessageType,
    // TODO Strongly type this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
}

export enum LocationState {
    Loading,
    Disabled,
    Preset,
    Live
}

export enum WorkerMessageType {
    Notification = 'cloudtak:notification',

    Map_FlyTo = 'cloudtak:map:flyto',
    Map_Projection = 'cloudtak:map:projection',

    Profile_Callsign = 'cloudtak:profile:callsign',
    Profile_Display_Zoom = 'cloudtak:profile:display:zoom',
    Profile_Distance_Unit = 'cloudtak:profile:distance:unit',
    Profile_Location_Coordinates = 'cloudtak:profile:location:coordinates',
    Profile_Location_Source = 'cloudtak:profile:location:source',

    Feature_Archived_Added = 'cloudtak:feature:archived:added',
    Feature_Archived_Removed = 'cloudtak:feature:archived:removed',

    Channels_None = 'channels:none',
    Channels_List = 'channels:list',

    Contact_Change = 'contact:change',

    Connection_Open = 'connection:open',
    Connection_Close = 'connection:close',

    Mission_Change_Feature = 'mission:change:feature',
}

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

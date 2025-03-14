export enum WorkerMessage {
    Notification = 'cloudtak:notification',

    Map_FlyTo = 'cloudtak:map:flyto',
    Map_Projection = 'cloudtak:map:projection',

    Profile_Callsign = 'cloudtak:profile:callsign',

    Channels_None = 'channels:none',
    Channels_List = 'channels:list',

    Connection_Open = 'connection:open',
    Connection_Close = 'connection:close',
}

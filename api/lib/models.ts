import Modeler, { Pool } from '@openaddresses/batch-generic';
import ProfileChat from './models/ProfileChat.js';
import Icon from './models/Icon.js';
import * as pgtypes from './schema.js';

export default class Models {
    Basemap: Modeler<typeof pgtypes.Basemap>;
    Import: Modeler<typeof pgtypes.Import>;
    Data: Modeler<typeof pgtypes.Data>;
    Server: Modeler<typeof pgtypes.Server>;
    Token: Modeler<typeof pgtypes.Token>;

    Connection: Modeler<typeof pgtypes.Connection>;
    ConnectionSink: Modeler<typeof pgtypes.ConnectionSink>;
    ConnectionToken: Modeler<typeof pgtypes.ConnectionToken>;

    Setting: Modeler<typeof pgtypes.Setting>;

    Profile: Modeler<typeof pgtypes.Profile>;
    ProfileChat: ProfileChat;
    ProfileOverlay: Modeler<typeof pgtypes.ProfileOverlay>;
    ProfileMission: Modeler<typeof pgtypes.ProfileMission>;

    Iconset: Modeler<typeof pgtypes.Iconset>;
    Icon: Icon;

    Layer: Modeler<typeof pgtypes.Layer>;
    LayerAlert: Modeler<typeof pgtypes.LayerAlert>;

    constructor(pg: Pool<typeof pgtypes>) {
        this.ProfileChat = new ProfileChat(pg);
        this.Icon = new Icon(pg);

        this.Token = new Modeler(pg, pgtypes.Token);
        this.Setting = new Modeler(pg, pgtypes.Setting);
        this.Server = new Modeler(pg, pgtypes.Server);
        this.Profile = new Modeler(pg, pgtypes.Profile);
        this.ProfileOverlay = new Modeler(pg, pgtypes.ProfileOverlay);
        this.ProfileMission = new Modeler(pg, pgtypes.ProfileMission);
        this.Basemap = new Modeler(pg, pgtypes.Basemap);
        this.Import = new Modeler(pg, pgtypes.Import);
        this.Connection = new Modeler(pg, pgtypes.Connection);
        this.ConnectionToken = new Modeler(pg, pgtypes.ConnectionToken);
        this.ConnectionSink = new Modeler(pg, pgtypes.ConnectionSink);
        this.Data = new Modeler(pg, pgtypes.Data);
        this.Iconset = new Modeler(pg, pgtypes.Iconset);
        this.Layer = new Modeler(pg, pgtypes.Layer);
        this.LayerAlert = new Modeler(pg, pgtypes.LayerAlert);
    }
}

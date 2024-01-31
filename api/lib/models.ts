import Modeler, { Pool } from '@openaddresses/batch-generic';
import ProfileChat from './models/ProfileChat.js';
import * as pgtypes from './schema.js';

export default class Models {
    ProfileChat: ProfileChat;
    Basemap: Modeler<typeof pgtypes.Basemap>;
    Import: Modeler<typeof pgtypes.Import>;
    Data: Modeler<typeof pgtypes.Data>;
    Connection: Modeler<typeof pgtypes.Connection>;
    ConnectionSink: Modeler<typeof pgtypes.ConnectionSink>;
    Profile: Modeler<typeof pgtypes.Profile>;
    ProfileOverlay: Modeler<typeof pgtypes.ProfileOverlay>;
    Iconset: Modeler<typeof pgtypes.Iconset>;
    Icon: Modeler<typeof pgtypes.Icon>;
    Server: Modeler<typeof pgtypes.Server>;
    Token: Modeler<typeof pgtypes.Token>;
    Layer: Modeler<typeof pgtypes.Layer>;
    LayerAlert: Modeler<typeof pgtypes.LayerAlert>;

    constructor(pg: Pool<typeof pgtypes>) {
        this.ProfileChat = new ProfileChat(pg);

        this.Token = new Modeler(pg, pgtypes.Token);
        this.Server = new Modeler(pg, pgtypes.Server);
        this.Profile = new Modeler(pg, pgtypes.Profile);
        this.ProfileOverlay = new Modeler(pg, pgtypes.ProfileOverlay);
        this.Basemap = new Modeler(pg, pgtypes.Basemap);
        this.Import = new Modeler(pg, pgtypes.Import);
        this.Connection = new Modeler(pg, pgtypes.Connection);
        this.ConnectionSink = new Modeler(pg, pgtypes.ConnectionSink);
        this.Data = new Modeler(pg, pgtypes.Data);
        this.Iconset = new Modeler(pg, pgtypes.Iconset);
        this.Icon = new Modeler(pg, pgtypes.Icon);
        this.Layer = new Modeler(pg, pgtypes.Layer);
        this.LayerAlert = new Modeler(pg, pgtypes.LayerAlert);
    }
}

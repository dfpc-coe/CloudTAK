import Modeler, { Pool } from '@openaddresses/batch-generic';
import Data from './models/Data.js';
import Layer from './models/Layer.js';
import Basemap from './models/Basemap.js';
import Palette from './models/Palette.js';
import Setting from './models/Setting.js';
import ProfileChat from './models/ProfileChat.js';
import Icon from './models/Icon.js';
import * as pgtypes from './schema.js';

export default class Models {
    Basemap: Basemap;
    Import: Modeler<typeof pgtypes.Import>;
    Data: Data;
    Server: Modeler<typeof pgtypes.Server>;
    Token: Modeler<typeof pgtypes.Token>;

    Connection: Modeler<typeof pgtypes.Connection>;
    ConnectionSink: Modeler<typeof pgtypes.ConnectionSink>;
    ConnectionToken: Modeler<typeof pgtypes.ConnectionToken>;

    Setting: Setting;

    Palette: Palette;
    PaletteFeature: Modeler<typeof pgtypes.PaletteFeature>;

    Profile: Modeler<typeof pgtypes.Profile>;
    ProfileChat: ProfileChat;
    ProfileInterest: Modeler<typeof pgtypes.ProfileInterest>;
    ProfileFeature: Modeler<typeof pgtypes.ProfileFeature>;
    ProfileOverlay: Modeler<typeof pgtypes.ProfileOverlay>;
    ProfileMission: Modeler<typeof pgtypes.ProfileMission>;

    VideoLease: Modeler<typeof pgtypes.VideoLease>;

    Task: Modeler<typeof pgtypes.Task>;

    Iconset: Modeler<typeof pgtypes.Iconset>;
    Icon: Icon;

    Errors: Modeler<typeof pgtypes.Errors>;

    Layer: Layer;
    LayerIncoming: Modeler<typeof pgtypes.LayerIncoming>;
    LayerOutgoing: Modeler<typeof pgtypes.LayerOutgoing>;
    LayerTemplate: Modeler<typeof pgtypes.LayerTemplate>;
    LayerAlert: Modeler<typeof pgtypes.LayerAlert>;

    constructor(pg: Pool<typeof pgtypes>) {
        this.ProfileChat = new ProfileChat(pg);
        this.Icon = new Icon(pg);

        this.Errors = new Modeler(pg, pgtypes.Errors);

        this.Token = new Modeler(pg, pgtypes.Token);
        this.Setting = new Setting(pg);
        this.Server = new Modeler(pg, pgtypes.Server);

        this.Palette = new Palette(pg);
        this.PaletteFeature = new Modeler(pg, pgtypes.PaletteFeature);

        this.Profile = new Modeler(pg, pgtypes.Profile);
        this.ProfileInterest = new Modeler(pg, pgtypes.ProfileInterest);
        this.ProfileFeature = new Modeler(pg, pgtypes.ProfileFeature);
        this.ProfileOverlay = new Modeler(pg, pgtypes.ProfileOverlay);
        this.ProfileMission = new Modeler(pg, pgtypes.ProfileMission);
        this.Basemap = new Basemap(pg);
        this.Import = new Modeler(pg, pgtypes.Import);
        this.VideoLease = new Modeler(pg, pgtypes.VideoLease);
        this.Connection = new Modeler(pg, pgtypes.Connection);
        this.ConnectionToken = new Modeler(pg, pgtypes.ConnectionToken);
        this.ConnectionSink = new Modeler(pg, pgtypes.ConnectionSink);
        this.Task = new Modeler(pg, pgtypes.Task);
        this.Data = new Data(pg);
        this.Iconset = new Modeler(pg, pgtypes.Iconset);
        this.Layer = new Layer(pg);
        this.LayerIncoming = new Modeler(pg, pgtypes.LayerIncoming);
        this.LayerOutgoing = new Modeler(pg, pgtypes.LayerOutgoing);

        this.LayerAlert = new Modeler(pg, pgtypes.LayerAlert);
        this.LayerTemplate = new Modeler(pg, pgtypes.LayerTemplate);
    }
}

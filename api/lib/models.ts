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

    Connection: Modeler<typeof pgtypes.Connection>;
    ConnectionToken: Modeler<typeof pgtypes.ConnectionToken>;
    ConnectionFeature: Modeler<typeof pgtypes.ConnectionFeature>;

    Setting: Setting;

    Palette: Palette;
    PaletteFeature: Modeler<typeof pgtypes.PaletteFeature>;

    Profile: Modeler<typeof pgtypes.Profile>;
    ProfileChat: ProfileChat;
    ProfileToken: Modeler<typeof pgtypes.ProfileToken>;
    ProfileInterest: Modeler<typeof pgtypes.ProfileInterest>;
    ProfileFeature: Modeler<typeof pgtypes.ProfileFeature>;
    ProfileOverlay: Modeler<typeof pgtypes.ProfileOverlay>;
    ProfileMission: Modeler<typeof pgtypes.ProfileMission>;
    ProfileFile: Modeler<typeof pgtypes.ProfileFile>;
    ProfileVideo: Modeler<typeof pgtypes.ProfileVideo>;

    VideoLease: Modeler<typeof pgtypes.VideoLease>;

    Task: Modeler<typeof pgtypes.Task>;

    Iconset: Modeler<typeof pgtypes.Iconset>;
    Icon: Icon;

    Errors: Modeler<typeof pgtypes.Errors>;

    Layer: Layer;
    LayerIncoming: Modeler<typeof pgtypes.LayerIncoming>;
    LayerOutgoing: Modeler<typeof pgtypes.LayerOutgoing>;
    LayerAlert: Modeler<typeof pgtypes.LayerAlert>;

    constructor(pg: Pool<typeof pgtypes>) {
        this.ProfileChat = new ProfileChat(pg);
        this.Icon = new Icon(pg);

        this.Errors = new Modeler(pg, pgtypes.Errors);

        this.Setting = new Setting(pg);
        this.Server = new Modeler(pg, pgtypes.Server);

        this.Palette = new Palette(pg);
        this.PaletteFeature = new Modeler(pg, pgtypes.PaletteFeature);

        this.Profile = new Modeler(pg, pgtypes.Profile);
        this.ProfileToken = new Modeler(pg, pgtypes.ProfileToken);
        this.ProfileFile = new Modeler(pg, pgtypes.ProfileFile);
        this.ProfileInterest = new Modeler(pg, pgtypes.ProfileInterest);
        this.ProfileFeature = new Modeler(pg, pgtypes.ProfileFeature);
        this.ProfileOverlay = new Modeler(pg, pgtypes.ProfileOverlay);
        this.ProfileMission = new Modeler(pg, pgtypes.ProfileMission);
        this.ProfileVideo = new Modeler(pg, pgtypes.ProfileVideo);
        this.Basemap = new Basemap(pg);
        this.Import = new Modeler(pg, pgtypes.Import);
        this.VideoLease = new Modeler(pg, pgtypes.VideoLease);
        this.Connection = new Modeler(pg, pgtypes.Connection);
        this.ConnectionToken = new Modeler(pg, pgtypes.ConnectionToken);
        this.ConnectionFeature = new Modeler(pg, pgtypes.ConnectionFeature);
        this.Task = new Modeler(pg, pgtypes.Task);
        this.Data = new Data(pg);
        this.Iconset = new Modeler(pg, pgtypes.Iconset);
        this.Layer = new Layer(pg);
        this.LayerIncoming = new Modeler(pg, pgtypes.LayerIncoming);
        this.LayerOutgoing = new Modeler(pg, pgtypes.LayerOutgoing);

        this.LayerAlert = new Modeler(pg, pgtypes.LayerAlert);
    }
}

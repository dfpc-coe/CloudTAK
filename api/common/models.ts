import Modeler, { Pool } from '@openaddresses/batch-generic';
import CoreDevice from './models/CoreDevice.js';
import CoreEntity from './models/CoreEntity.js';
import CoreEntityBoardEvent from './models/CoreEntityBoardEvent.js';
import CoreForm from './models/CoreForm.js';
import CoreFormResponse from './models/CoreFormResponse.js';
import Data from './models/Data.js';
import Import from './models/Import.js';
import Layer from './models/Layer.js';
import Basemap from './models/Basemap.js';
import MissionTemplate from './models/MissionTemplate.js';
import MissionTemplateLog from './models/MissionTemplateLog.js';
import Setting from './models/Setting.js';
import ProfileChat from './models/ProfileChat.js';
import ProfileConfig from './models/ProfileConfig.js';
import ProfilePasskey from './models/ProfilePasskey.js';
import ProfileFile from './models/ProfileFile.js';
import Icon from './models/Icon.js';
import * as pgtypes from './schema.js';

export default class Models {
    Basemap: Basemap;
    Import: Import;
    ImportResult: Modeler<typeof pgtypes.ImportResult>;
    Data: Data;
    Server: Modeler<typeof pgtypes.Server>;

    Channel: Modeler<typeof pgtypes.Channel>;

    CoreDevice: CoreDevice;
    CoreDeviceChannel: Modeler<typeof pgtypes.CoreDeviceChannel>;
    CoreEntity: CoreEntity;
    CoreEntityBoard: Modeler<typeof pgtypes.CoreEntityBoard>;
    CoreEntityBoardColumn: Modeler<typeof pgtypes.CoreEntityBoardColumn>;
    CoreEntityBoardEvent: CoreEntityBoardEvent;
    CoreEntityAssignment: Modeler<typeof pgtypes.CoreEntityAssignment>;
    CoreEntityEffect: Modeler<typeof pgtypes.CoreEntityEffect>;
    CoreForm: CoreForm;
    CoreFormChannel: Modeler<typeof pgtypes.CoreFormChannel>;
    CoreFormColumn: Modeler<typeof pgtypes.CoreFormColumn>;
    CoreFormResponse: CoreFormResponse;
    CoreEntityResponse: Modeler<typeof pgtypes.CoreEntityResponse>;

    Connection: Modeler<typeof pgtypes.Connection>;
    ConnectionToken: Modeler<typeof pgtypes.ConnectionToken>;
    ConnectionFeature: Modeler<typeof pgtypes.ConnectionFeature>;

    Setting: Setting;

    PaletteFeature: Modeler<typeof pgtypes.PaletteFeature>;

    MissionTemplate: MissionTemplate;
    MissionTemplateLog: MissionTemplateLog;

    Profile: Modeler<typeof pgtypes.Profile>;
    ProfileConfig: ProfileConfig;
    ProfileChat: ProfileChat;
    ProfileToken: Modeler<typeof pgtypes.ProfileToken>;
    ProfileInterest: Modeler<typeof pgtypes.ProfileInterest>;
    ProfileFeature: Modeler<typeof pgtypes.ProfileFeature>;
    ProfileOverlay: Modeler<typeof pgtypes.ProfileOverlay>;
    ProfileFile: ProfileFile;
    ProfilePaging: Modeler<typeof pgtypes.ProfilePaging>;
    ProfileSession: Modeler<typeof pgtypes.ProfileSession>;
    ProfilePasskey: ProfilePasskey;
    ProfileVideo: Modeler<typeof pgtypes.ProfileVideo>;

    VideoLease: Modeler<typeof pgtypes.VideoLease>;

    Integration: Modeler<typeof pgtypes.Integration>;

    Iconset: Modeler<typeof pgtypes.Iconset>;
    Icon: Icon;

    Errors: Modeler<typeof pgtypes.Errors>;

    Layer: Layer;
    LayerIncoming: Modeler<typeof pgtypes.LayerIncoming>;
    LayerMapping: Modeler<typeof pgtypes.LayerMapping>;
    LayerOutgoing: Modeler<typeof pgtypes.LayerOutgoing>;

    constructor(pg: Pool<typeof pgtypes>) {
        this.Channel = new Modeler(pg, pgtypes.Channel);
        this.CoreDevice = new CoreDevice(pg);
        this.CoreDeviceChannel = new Modeler(pg, pgtypes.CoreDeviceChannel);
        this.CoreEntity = new CoreEntity(pg);
        this.CoreEntityBoard = new Modeler(pg, pgtypes.CoreEntityBoard);
        this.CoreEntityBoardColumn = new Modeler(pg, pgtypes.CoreEntityBoardColumn);
        this.CoreEntityBoardEvent = new CoreEntityBoardEvent(pg);
        this.CoreEntityAssignment = new Modeler(pg, pgtypes.CoreEntityAssignment);
        this.CoreEntityEffect = new Modeler(pg, pgtypes.CoreEntityEffect);
        this.CoreForm = new CoreForm(pg);
        this.CoreFormChannel = new Modeler(pg, pgtypes.CoreFormChannel);
        this.CoreFormColumn = new Modeler(pg, pgtypes.CoreFormColumn);
        this.CoreFormResponse = new CoreFormResponse(pg);
        this.CoreEntityResponse = new Modeler(pg, pgtypes.CoreEntityResponse);
        this.ProfileChat = new ProfileChat(pg);
        this.Icon = new Icon(pg);

        this.Errors = new Modeler(pg, pgtypes.Errors);

        this.Setting = new Setting(pg);
        this.Server = new Modeler(pg, pgtypes.Server);

        this.PaletteFeature = new Modeler(pg, pgtypes.PaletteFeature);

        this.MissionTemplate = new MissionTemplate(pg);
        this.MissionTemplateLog = new MissionTemplateLog(pg);

        this.Profile = new Modeler(pg, pgtypes.Profile);
        this.ProfileConfig = new ProfileConfig(pg);
        this.ProfileToken = new Modeler(pg, pgtypes.ProfileToken);
        this.ProfileFile = new ProfileFile(pg);
        this.ProfileInterest = new Modeler(pg, pgtypes.ProfileInterest);
        this.ProfileFeature = new Modeler(pg, pgtypes.ProfileFeature);
        this.ProfileOverlay = new Modeler(pg, pgtypes.ProfileOverlay);
        this.ProfileVideo = new Modeler(pg, pgtypes.ProfileVideo);
        this.ProfilePaging = new Modeler(pg, pgtypes.ProfilePaging);
        this.ProfileSession = new Modeler(pg, pgtypes.ProfileSession);
        this.ProfilePasskey = new ProfilePasskey(pg);
        this.Basemap = new Basemap(pg);
        this.Import = new Import(pg);
        this.ImportResult = new Modeler(pg, pgtypes.ImportResult);
        this.VideoLease = new Modeler(pg, pgtypes.VideoLease);
        this.Connection = new Modeler(pg, pgtypes.Connection);
        this.ConnectionToken = new Modeler(pg, pgtypes.ConnectionToken);
        this.ConnectionFeature = new Modeler(pg, pgtypes.ConnectionFeature);
        this.Integration = new Modeler(pg, pgtypes.Integration);
        this.Data = new Data(pg);
        this.Iconset = new Modeler(pg, pgtypes.Iconset);
        this.Layer = new Layer(pg);
        this.LayerIncoming = new Modeler(pg, pgtypes.LayerIncoming);
        this.LayerMapping = new Modeler(pg, pgtypes.LayerMapping);
        this.LayerOutgoing = new Modeler(pg, pgtypes.LayerOutgoing);
    }
}

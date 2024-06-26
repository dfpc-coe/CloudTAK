import { Static } from '@sinclair/typebox';
import { ESRILayer, ESRIField } from './types.js';

export default class Layer {
    layers: Array<Static<typeof ESRILayer>>;

    constructor(layers: Array<Static<typeof ESRILayer>> = [DefaultLayer]) {
        this.layers = layers;
    }

    /**
     * TAK Layers by geometry type are treated as having all the same fields
     */
    addField(field: Static<typeof ESRIField>) {
        for (const layer of this.layers) {
            layer.fields.push(field);
        }
    }
}

export const DefaultLayer: Static<typeof ESRILayer> = {
    id: 0,
    name: 'TAK ETL Points',
    description: 'CoT message Points',
    type: 'Feature Layer',
    displayField: 'callsign',
    supportedQueryFormats: 'JSON',
    capabilities: "Create,Delete,Query,Update,Editing,Extract,Sync",
    geometryType: 'esriGeometryPoint',
    allowGeometryUpdates: true,
    hasAttachments: false,
    hasM: false,
    hasZ: false,
    objectIdField: 'objectid',
    extent: {
        xmin: -20037508.34,
        ymin: -20048966.1,
        xmax: 20037508.34,
        ymax: 20048966.1,
        spatialReference: { wkid: 102100, latestWkid: 3857 },
    },
    uniqueIdField: {
        name: "objectid",
        isSystemMaintained: true
    },
    fields: [{
        "name": "objectid",
        "type": "esriFieldTypeOID",
        "actualType": "int",
        "alias": "fid",
        "sqlType": "sqlTypeInteger",
        "length": 4,
        "nullable": false,
        "editable": false,
        "domain": null,
        "defaultValue": null
    },{
        "name": "cotuid",
        "type": "esriFieldTypeString",
        "actualType": "nvarchar",
        "alias": "cotuid1",
        "sqlType": "sqlTypeNVarchar",
        "length": 100,
        "nullable": false,
        "editable": true,
        "domain": null,
        "defaultValue": null
    },{
        "name": "remarks",
        "type": "esriFieldTypeString",
        "actualType": "nvarchar",
        "alias": "remarks",
        "sqlType": "sqlTypeNVarchar",
        "length": 2000,
        "nullable": false,
        "editable": true,
        "domain": null,
        "defaultValue": null
    },{
        "name": "callsign",
        "type": "esriFieldTypeString",
        "actualType": "nvarchar",
        "alias": "callsign",
        "sqlType": "sqlTypeNVarchar",
        "length": 100,
        "nullable": true,
        "editable": true,
        "domain": null,
        "defaultValue": null
    },{
        "name": "type",
        "type": "esriFieldTypeString",
        "actualType": "nvarchar",
        "alias": "type",
        "sqlType": "sqlTypeNVarchar",
        "length": 100,
        "nullable": true,
        "editable": true,
        "domain": null,
        "defaultValue": null
    },{
        "name": "how",
        "type": "esriFieldTypeString",
        "actualType": "nvarchar",
        "alias": "how",
        "sqlType": "sqlTypeNVarchar",
        "length": 100,
        "nullable": true,
        "editable": true,
        "domain": null,
        "defaultValue": null
    },{
        "name": "time",
        "type": "esriFieldTypeDate",
        "actualType": "datetime2",
        "alias": "time",
        "sqlType": "sqlTypeTimestamp2",
        "length": 100,
        "nullable": true,
        "editable": true,
        "domain": null,
        "defaultValue": null
    },{
        "name": "start",
        "type": "esriFieldTypeDate",
        "actualType": "datetime2",
        "alias": "start",
        "sqlType": "sqlTypeTimestamp2",
        "length": 100,
        "nullable": true,
        "editable": true,
        "domain": null,
        "defaultValue": null
    },{
        "name": "stale",
        "type": "esriFieldTypeDate",
        "actualType": "datetime2",
        "alias": "stale",
        "sqlType": "sqlTypeTimestamp2",
        "length": 100,
        "nullable": true,
        "editable": true,
        "domain": null,
        "defaultValue": null
    }]
}

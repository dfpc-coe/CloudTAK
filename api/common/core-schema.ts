import { Type } from '@sinclair/typebox';
import type { TObject } from '@sinclair/typebox';
import { StyleSingle } from './style.js';
import { LayerMapping_Destination, CoreEvent_Priority } from './enums.js';

export const CoreFeatureSchema = Type.Object(StyleSingle.properties, {
    title: 'Core Feature',
    description: 'GeoJSON Feature styled & delivered to the TAK Server as CoT',
});

/**
 * Properties carry an `@icon` hint - the name of the Tabler icon shown next to
 * the property in generated forms
 */
export const CoreEventSchema = Type.Object({
    name: Type.String({ 'title': 'Name', '@icon': 'IconTag', 'description': 'Human readable name of the Event' }),
    type: Type.String({ 'title': 'Type', '@icon': 'IconCategory', 'description': 'MIL-STD-2525E Symbol ID' }),
    priority: Type.Optional(Type.Unsafe<CoreEvent_Priority>({ 'type': 'string', 'title': 'Priority', '@icon': 'IconFlag', 'description': 'Priority of the Event', 'enum': Object.values(CoreEvent_Priority), 'default': CoreEvent_Priority.NONE })),
    location: Type.Optional(Type.String({ 'title': 'Location', '@icon': 'IconMapPin', 'description': 'Human readable location - ie: an address' })),
    remarks: Type.Optional(Type.String({ 'title': 'Remarks', '@icon': 'IconBlockquote', 'description': 'Free text remarks about the Event' })),
    ended: Type.Optional(Type.String({ 'title': 'Ended', '@icon': 'IconCalendarOff', 'description': 'Time at which the Event ended', 'format': 'date-time' })),
    external_id: Type.Optional(Type.String({ 'title': 'External ID', '@icon': 'IconLicense', 'description': 'ID of the Event in an external system' })),
    editable: Type.Optional(Type.Boolean({ 'title': 'Editable', '@icon': 'IconLock', 'description': 'Can users other than the creator edit the Event', 'default': true })),
}, {
    title: 'Core Event',
    description: 'Incident or planned Event tracked by CloudTAK',
});

export const CoreDeviceSchema = Type.Object({
    name: Type.String({ 'title': 'Name', '@icon': 'IconTag', 'description': 'Human readable name/callsign of the Device' }),
    type: Type.String({ 'title': 'Type', '@icon': 'IconCategory', 'description': 'MIL-STD-2525E Symbol ID' }),
    manufacturer: Type.Optional(Type.String({ 'title': 'Manufacturer', '@icon': 'IconBuildingFactory2', 'description': 'Manufacturer of the Device - ie: Ortec, Nucsafe, DJI' })),
    model: Type.Optional(Type.String({ 'title': 'Model', '@icon': 'IconBox', 'description': 'Model of the Device - ie: Micro Detective, IdentiFINDER 2' })),
    serial: Type.Optional(Type.String({ 'title': 'Serial', '@icon': 'IconBarcode', 'description': 'Manufacturer assigned Serial Number' })),
    firmware: Type.Optional(Type.String({ 'title': 'Firmware', '@icon': 'IconVersions', 'description': 'Firmware/Software revision reported by the Device' })),
    status: Type.Optional(Type.String({ 'title': 'Status', '@icon': 'IconHeartbeat', 'description': 'General Device health status - ie: Full, Reduced, Unknown' })),
    battery: Type.Optional(Type.Number({ 'title': 'Battery', '@icon': 'IconBattery', 'description': 'Battery level as a percentage (0-100) at last report', 'minimum': 0, 'maximum': 100 })),
    simulated: Type.Optional(Type.Boolean({ 'title': 'Simulated', '@icon': 'IconTestPipe', 'description': 'Is the Device a simulated data source', 'default': false })),
    external_id: Type.Optional(Type.String({ 'title': 'External ID', '@icon': 'IconLicense', 'description': 'ID of the Device in an external system' })),
    remarks: Type.Optional(Type.String({ 'title': 'Remarks', '@icon': 'IconBlockquote', 'description': 'Free text remarks about the Device' })),
}, {
    title: 'Core Device',
    description: 'Sensor or other hardware Device reporting to CloudTAK',
});

/** A schema without its `@icon` form hints - for composing API request & response types */
export function withoutHints<T extends TObject>(schema: T): T {
    return Type.Object(Object.fromEntries(Object.entries(schema.properties).map(([key, property]) => {
        const rest = { ...property };
        delete rest['@icon'];
        return [key, rest];
    }))) as unknown as T;
}

/** JSON Schemas of the record types the Server can convert submitted data into */
export const CoreSchemas: Record<LayerMapping_Destination, TObject> = {
    [LayerMapping_Destination.COREFEATURE]: CoreFeatureSchema,
    [LayerMapping_Destination.COREEVENT]: CoreEventSchema,
    [LayerMapping_Destination.COREDEVICE]: CoreDeviceSchema,
};

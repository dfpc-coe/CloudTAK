import { Type } from '@sinclair/typebox';
import type { TObject, TSchema } from '@sinclair/typebox';
import { StyleSingle } from './style.js';
import { LayerMapping_Destination, CoreEvent_Priority } from './enums.js';

export const CoreFeatureSchema = Type.Object(StyleSingle.properties, {
    title: 'Core Feature',
    description: 'GeoJSON Feature styled & delivered to the TAK Server as CoT',
});

const Channels = Type.Array(Type.Integer({ minimum: 0 }), {
    'title': 'Channels',
    '@icon': 'IconAffiliate',
    '@widget': 'channels',
    'description': 'TAK Server Channels the record is shared with - a submitted record without any inherits the active Channels of its Connection',
    'uniqueItems': true,
});

export const CoreEventLinkSchema = Type.Object({
    name: Type.String({ title: 'Name', description: 'Human readable name of the Link' }),
    url: Type.String({ title: 'URL', description: 'URL the Link points at', pattern: '^(https?:\\/\\/.+|)$' }),
});

/** Point styling overrides - property names match node-cot's CoT GeoJSON representation */
export const CoreEventStyleSchema = Type.Object({
    'icon': Type.Optional(Type.String({ 'title': 'Icon', '@icon': 'IconPhoto', '@widget': 'icon', 'description': 'Iconset Icon path to render the Event with - ie: <iconset uid>/<icon path>' })),
    'marker-color': Type.Optional(Type.String({ 'title': 'Marker Color', '@icon': 'IconPaint', '@widget': 'color', 'description': 'Hex colour of the Event marker - ie: #00ff00' })),
    'marker-opacity': Type.Optional(Type.Number({ 'title': 'Marker Opacity', '@icon': 'IconGhost', 'description': 'Opacity of the Event marker', 'minimum': 0, 'maximum': 1 })),
}, {
    title: 'Style',
});

/**
 * Properties carry form hints, stripped by `withoutHints` when composing API types
 * - `@icon`: name of the Tabler icon shown next to the property
 * - `@widget`: input used in place of the one implied by the property type
 * - `@relative`: a date-time a Map may also give as a number of seconds from now
 */
export const CoreEventSchema = Type.Object({
    name: Type.String({ 'title': 'Name', '@icon': 'IconTag', 'description': 'Human readable name of the Event' }),
    type: Type.String({ 'title': 'Type', '@icon': 'IconCategory', 'description': 'MIL-STD-2525E Symbol ID' }),
    priority: Type.Optional(Type.Unsafe<CoreEvent_Priority>({ 'type': 'string', 'title': 'Priority', '@icon': 'IconFlag', 'description': 'Priority of the Event', 'enum': Object.values(CoreEvent_Priority), 'default': CoreEvent_Priority.NONE })),
    location: Type.Optional(Type.String({ 'title': 'Location', '@icon': 'IconMapPin', 'description': 'Human readable location - ie: an address' })),
    remarks: Type.Optional(Type.String({ 'title': 'Remarks', '@icon': 'IconBlockquote', 'description': 'Free text remarks about the Event' })),
    started: Type.Optional(Type.String({ 'title': 'Started', '@icon': 'IconCalendarEvent', 'description': 'Time at which the Event started - defaults to the time of creation', 'format': 'date-time' })),
    ended: Type.Optional(Type.String({ 'title': 'Ended', '@icon': 'IconCalendarOff', '@relative': true, 'description': 'Time at which the Event ends - a future time keeps the Event active until then, a Map value of a number of seconds ends the Event that far from submission', 'format': 'date-time' })),
    active: Type.Optional(Type.Boolean({ 'title': 'Active', '@icon': 'IconActivity', 'description': 'Is the Event active - derived from ended, false ends the Event now & true clears ended', 'default': true })),
    external_id: Type.Optional(Type.String({ 'title': 'External ID', '@icon': 'IconLicense', 'description': 'ID of the Event in an external system' })),
    editable: Type.Optional(Type.Boolean({ 'title': 'Editable', '@icon': 'IconLock', 'description': 'Can users other than the creator edit the Event', 'default': true })),
    channels: Type.Optional(Channels),
    style: Type.Optional(CoreEventStyleSchema),
    links: Type.Optional(Type.Array(CoreEventLinkSchema, { 'title': 'Links', '@icon': 'IconLink', 'description': 'Named URLs associated with the Event' })),
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
    event_external_id: Type.Optional(Type.String({ 'title': 'Event', '@icon': 'IconCalendarEvent', 'description': 'External ID of the Core Event of the Connection the Device is assigned to - an empty result unassigns the Device' })),
    channels: Type.Optional(Channels),
}, {
    title: 'Core Device',
    description: 'Sensor or other hardware Device reporting to CloudTAK',
});

function strip(schema: TSchema): TSchema {
    const rest: TSchema = { ...schema };

    for (const key of Object.keys(rest)) {
        if (key.startsWith('@')) delete rest[key];
    }

    if (rest.properties) {
        rest.properties = Object.fromEntries(Object.entries<TSchema>(rest.properties).map(([key, property]) => [key, strip(property)]));
    }

    if (rest.items) rest.items = strip(rest.items);

    return rest;
}

/** A schema without its `@` form hints - for composing API request & response types */
export function withoutHints<T extends TObject>(schema: T): T {
    return strip(schema) as T;
}

/** JSON Schemas of the record types the Server can convert submitted data into */
export const CoreSchemas: Record<LayerMapping_Destination, TObject> = {
    [LayerMapping_Destination.COREFEATURE]: CoreFeatureSchema,
    [LayerMapping_Destination.COREEVENT]: CoreEventSchema,
    [LayerMapping_Destination.COREDEVICE]: CoreDeviceSchema,
};

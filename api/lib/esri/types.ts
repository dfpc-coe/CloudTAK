import { Type } from '@sinclair/typebox';

export const ESRIField = Type.Object({
    name: Type.String(),
    type: Type.String(),
    actualType: Type.String(),
    alias: Type.String(),
    sqlType: Type.String(),
    length: Type.Optional(Type.Number()),
    nullable: Type.Boolean(),
    editable: Type.Boolean(),
    domain: Type.Any(),
    defaultValue: Type.Any()
})

export const ESRILayer = Type.Object({
    id: Type.Integer(),
    name: Type.String(),
    description: Type.String(),
    type: Type.String(),
    displayField: Type.Optional(Type.String()),
    supportedQueryFormats: Type.String(),
    capabilities: Type.String(),
    geometryType: Type.String(),
    allowGeometryUpdates: Type.Boolean(),
    hasAttachments: Type.Boolean(),
    hasM: Type.Boolean(),
    hasZ: Type.Boolean(),
    objectIdField: Type.String(),
    extent: Type.Object({
        xmin: Type.Number(),
        ymin: Type.Number(),
        xmax: Type.Number(),
        ymax: Type.Number(),
        spatialReference: Type.Object({
            wkid: Type.Optional(Type.Number()),
            latestWkid: Type.Optional(Type.Number())
        }),
    }),
    uniqueIdField: Type.Optional(Type.Object({
        name: Type.String(),
        isSystemMaintained: Type.Boolean()
    })),
    fields: Type.Array(ESRIField)
})

export const ESRILayerList = Type.Object({
    layers: Type.Array(ESRILayer)
})


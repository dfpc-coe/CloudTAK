import { Type } from '@sinclair/typebox'

export const PaletteFeatureStyle = Type.Object({
    'marker-color': Type.Optional(Type.String()),
    'marker-opacity': Type.Optional(Type.String()),

    icon: Type.Optional(Type.String()),

    stroke: Type.Optional(Type.String()),
    'stroke-style': Type.Optional(Type.String()),
    'stroke-opacity': Type.Optional(Type.String()),
    'stroke-width': Type.Optional(Type.String()),
    fill: Type.Optional(Type.String()),
    'fill-opacity': Type.Optional(Type.String()),
})

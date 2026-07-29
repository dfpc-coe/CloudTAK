import { Type } from '@sinclair/typebox';

/**
 * A named URL associated with a Core Event - submitted to the TAK Server
 * as a CoT `link` with the `r-u` (refinement url) relation
 */
export const CoreEventLink = Type.Object({
    name: Type.String({
        description: 'Human readable name of the Link',
    }),
    url: Type.String({
        description: 'URL the Link points at',
    }),
});

/**
 * Stylistic overrides for the Point the Core Event is rendered as -
 * property names match the CoT GeoJSON representation in node-cot
 */
export const CoreEventStyle = Type.Object({
    'icon': Type.Optional(Type.String({
        description: 'Iconset Icon path to render the Event with - ie: <iconset uid>/<icon path>',
    })),
    'marker-color': Type.Optional(Type.String({
        description: 'Hex colour of the Event marker - ie: #00ff00',
    })),
    'marker-opacity': Type.Optional(Type.Number({
        minimum: 0,
        maximum: 1,
        description: 'Opacity of the Event marker',
    })),
});

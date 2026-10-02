import { Type } from '@sinclair/typebox';
import { EsriExtent } from '../esri/types.js';
import { Search_Type } from '../../../common/enums.js';
import { RouteManagerConfig } from '../routing/types.js';

export const SearchConfig = Type.Object({
    id: Type.String(),
    name: Type.String(),
    reverse: Type.Object({
        supported: Type.Boolean(),
    }),
    forward: Type.Object({
        supported: Type.Boolean(),
    }),
});

export const SearchProvidersConfig = Type.Object({
    reverse: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
        })),
    }),
    forward: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
        })),
    }),
});

export const SearchManagerConfig = Type.Object({
    reverse: SearchProvidersConfig.properties.reverse,
    route: RouteManagerConfig,
    forward: SearchProvidersConfig.properties.forward,
});

export const FetchType = Type.Enum(Search_Type, { description: 'Normalized category of the result' });

export const FetchReverse = Type.Object({
    type: Type.Optional(FetchType),
    LongLabel: Type.String(),
    ShortLabel: Type.String(),
    Addr_type: Type.String(),
});

export const FetchSuggest = Type.Object({
    type: Type.Optional(FetchType),
    text: Type.String(),
    magicKey: Type.String(),
    isCollection: Type.Boolean(),
});

export const FetchForward = Type.Object({
    type: Type.Optional(FetchType),
    address: Type.String(),
    location: Type.Object({
        x: Type.Number(),
        y: Type.Number(),
    }),
    score: Type.Number(),
    attributes: Type.Object({
        LongLabel: Type.Optional(Type.String()),
        ShortLabel: Type.Optional(Type.String()),
    }),
    extent: EsriExtent,
});

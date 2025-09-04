import { Type } from "@sinclair/typebox";
import { EsriExtent } from '../esri/types.js';

export const SearchConfig = Type.Object({
    id: Type.String(),
    name: Type.String(),
    reverse: Type.Object({
        supported: Type.Boolean(),
    }),
    forward: Type.Object({
        supported: Type.Boolean(),
    }),
    route: Type.Object({
        supported: Type.Boolean(),
        modes: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
        }))
    })
});

export const SearchManagerConfig = Type.Object({
    reverse: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
        }))
    }),
    route: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            modes: Type.Array(Type.Object({
                id: Type.String(),
                name: Type.String(),
            }))
        }))
    }),
    forward: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String()
        }))
    })
})

export const FetchReverse = Type.Object({
    LongLabel: Type.String(),
    ShortLabel: Type.String(),
    Addr_type: Type.String(),
});

export const FetchSuggest = Type.Object({
    text: Type.String(),
    magicKey: Type.String(),
    isCollection: Type.Boolean()
});

export const FetchForward = Type.Object({
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
    extent: EsriExtent
});

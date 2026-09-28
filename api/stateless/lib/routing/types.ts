import { Type } from '@sinclair/typebox';

export const RouteMode = Type.Object({
    id: Type.String(),
    name: Type.String(),
});

export const RouteConfig = Type.Object({
    id: Type.String(),
    name: Type.String(),
    modes: Type.Array(RouteMode),
});

export const RouteManagerConfig = Type.Object({
    enabled: Type.Boolean(),
    providers: Type.Array(RouteConfig),
});

export interface StyleLayerDef {
    id: string;
    type: string;
    name?: string;
    layout: Record<string, unknown>;
    paint: Record<string, unknown>;
    [key: string]: unknown;
}

import type { ETLLayerTaskCapabilities } from '../../../../types.ts';

export const DEFAULT_SCHEMA_ID = 'default';

export type NamedSchema = {
    id: string;
    schema: Record<string, unknown>;
};

export type DataFlow = 'incoming' | 'outgoing';

/** Named Output schemas a Task exposes for a data flow */
export function outputSchemas(capabilities: ETLLayerTaskCapabilities | undefined, flow: DataFlow = 'incoming'): NamedSchema[] {
    return capabilities?.[flow]?.schema?.output ?? [];
}

/** The `default` Output schema, falling back to the first named schema */
export function defaultOutputSchema(capabilities: ETLLayerTaskCapabilities | undefined, flow: DataFlow = 'incoming'): Record<string, unknown> | undefined {
    const schemas = outputSchemas(capabilities, flow);
    return (schemas.find((s) => s.id === DEFAULT_SCHEMA_ID) ?? schemas[0])?.schema;
}

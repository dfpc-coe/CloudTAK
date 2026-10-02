import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { server } from '../../../../std.ts';
import type { ETLLayerMapping } from '../../../../types.ts';

/** Mappings of the Layer addressed by the route, optionally restricted to a named Output schema */
export function useLayerMappings(schema?: string) {
    const route = useRoute();

    const mappings = ref<ETLLayerMapping[]>([]);
    const loading = ref(true);
    const error = ref<Error | undefined>();

    onMounted(async () => {
        try {
            const res = await server.GET('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping', {
                params: {
                    path: {
                        ':connectionid': Number(route.params.connectionid),
                        ':layerid': Number(route.params.layerid),
                    },
                    query: { schema },
                },
            });
            if (res.error) throw new Error(res.error.message);

            mappings.value = res.data.items;
        } catch (err) {
            error.value = err instanceof Error ? err : new Error(String(err));
        } finally {
            loading.value = false;
        }
    });

    return { mappings, loading, error };
}

<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>Elevation</label>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Loading elevation...'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else-if='elevation'
            class='col-12 d-flex align-items-center py-2 px-2 rounded'
            style='border: 1px solid var(--tblr-border-color);'
        >
            <IconMountain
                size='32'
                stroke='1'
            />
            <div class='mx-2'>
                <div
                    class='h3 mb-0'
                    v-text='elevation'
                />
            </div>
        </div>
        <div
            v-else
            class='col-12 d-flex py-2 px-2'
        >
            <div
                class='mx-2'
                style='font-size: 20px;'
            >
                No Elevation Data
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { SearchReverseElevation } from '../../../types.ts';
import { server } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    IconMountain
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerAlert
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    longitude: number;
    latitude: number;
}>();

const mapStore = useMapStore();

const loading = ref(true);
const error = ref<Error | undefined>();
const elevation = ref<SearchReverseElevation['elevation']>(null);

onMounted(async () => {
    try {
        let terrainElevation: number | undefined;
        try {
            const raw = mapStore.map.queryTerrainElevation([props.longitude, props.latitude]);
            terrainElevation = raw !== null ? raw : undefined;
        } catch {
            // No terrain data available
        }

        const { data, error: reqError } = await server.GET('/api/search/reverse/{:longitude}/{:latitude}/elevation', {
            params: {
                path: { ':longitude': props.longitude, ':latitude': props.latitude },
                query: { elevation: terrainElevation },
            },
        });

        if (reqError) throw new Error(String(reqError));
        elevation.value = data.elevation;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
});
</script>

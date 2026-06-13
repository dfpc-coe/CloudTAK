<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>Location</label>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Loading location...'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else-if='reverse'
            class='col-12 d-flex align-items-center py-2 px-2 rounded'
            style='border: 1px solid var(--tblr-border-color);'
        >
            <IconMapPin
                size='32'
                stroke='1'
            />

            <div class='mx-2'>
                <div
                    class='h3 mb-0'
                    v-text='reverse.ShortLabel'
                />
                <div
                    class='text-muted small'
                    v-text='reverse.LongLabel.replace(new RegExp(`^.*${reverse.ShortLabel}, `), "")'
                />
            </div>
            <div
                v-if='elevation'
                class='ms-auto text-end'
            >
                <div class='d-flex align-items-center text-muted'>
                    <IconMountain
                        size='16'
                        stroke='1'
                        class='me-1'
                    />
                    <span class='small'>{{ elevation }}</span>
                </div>
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
                No Features Found
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { SearchReverseReverse, SearchReverseElevation } from '../../../types.ts';
import { server } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    IconMapPin,
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
const reverse = ref<SearchReverseReverse['reverse']>(null);
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

        const [reverseRes, elevationRes] = await Promise.all([
            server.GET('/api/search/reverse/{:longitude}/{:latitude}/reverse', {
                params: {
                    path: { ':longitude': props.longitude, ':latitude': props.latitude },
                },
            }),
            server.GET('/api/search/reverse/{:longitude}/{:latitude}/elevation', {
                params: {
                    path: { ':longitude': props.longitude, ':latitude': props.latitude },
                    query: { elevation: terrainElevation },
                },
            }),
        ]);

        if (reverseRes.error) throw new Error(String(reverseRes.error));
        if (elevationRes.error) throw new Error(String(elevationRes.error));

        reverse.value = reverseRes.data.reverse;
        elevation.value = elevationRes.data.elevation;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
});
</script>

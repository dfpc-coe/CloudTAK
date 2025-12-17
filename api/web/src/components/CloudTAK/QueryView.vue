<template>
    <div
        class='sticky-top col-12 border-bottom border-light bg-dark'
        style='border-radius: 0px;'
    >
        <div class='modal-header px-0 mx-2 d-flex align-items-center'>
            <div class='modal-title'>
                Query Mode
            </div>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Refresh'
                    @click='fetch'
                >
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
    </div>
    <div
        class='col-12 overflow-auto'
        style='height: calc(100% - 106px)'
    >
        <Coordinate
            v-if='coords'
            :model-value='coords'
            class='py-2'
        />

        <TablerAlert
            v-if='error'
            :err='error'
        />
        <TablerLoading
            v-else-if='!query'
            desc='Querying...'
        />
        <template v-else>
            <QueryReverse
                :reverse='query.reverse'
                :elevation='query.elevation'
                class='py-2'
            />

            <QueryWeather
                :weather='query.weather'
                class='py-2'
            />

            <QuerySun
                :sun='query.sun'
                class='py-2'
            />

            <QueryMagnetic
                v-if='query.magnetic'
                :magnetic='query.magnetic'
                class='py-2'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import type { SearchReverse } from '../../types.ts';
import {
    IconRefresh
} from '@tabler/icons-vue';
import { std, stdurl } from '../../std.ts';
import { useMapStore } from '../../stores/map.ts';
import QueryWeather from './Query/Weather.vue';
import QuerySun from './Query/Sun.vue';
import QueryMagnetic from './Query/Magnetic.vue';
import QueryReverse from './Query/Reverse.vue';
import {
    TablerAlert,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import Coordinate from './util/Coordinate.vue';

const route = useRoute();
const mapStore = useMapStore();

const error = ref<Error | undefined>();
const query = ref<SearchReverse | undefined>();

const coords = computed<number[] | undefined>(() => {
    return route.params.coords
        ? String(route.params.coords).split(',').map(c => Number(c))
        : undefined
});

watch(coords, async () => {
    await fetch();
})

onMounted(async () => {
    await fetch();
});

async function fetch() {
    query.value = undefined;

    if (coords.value && coords.value.length >= 2) {
        try {
            error.value = undefined;
            
            // Query MapLibre terrain elevation if available
            let elevation: number | undefined;
            try {
                const terrainElevation = mapStore.map.queryTerrainElevation([coords.value[0], coords.value[1]]);
                elevation = terrainElevation !== null ? terrainElevation : undefined;
            } catch {
                // No terrain data available
            }
            
            const url = stdurl(`/api/search/reverse/${coords.value[0]}/${coords.value[1]}`);
            if (elevation !== undefined && elevation !== null) {
                url.searchParams.append('elevation', String(elevation));
            }
            
            query.value = await std(url) as SearchReverse;
        } catch (err) {
            error.value = err instanceof Error ? err : new Error(String(err));
        }
    }
}
</script>

<template>
    <MenuTemplate
        name='New Route'
        :loading='!mapStore.isLoaded'
    >
        <template #default>
            <TablerLoading
                v-if='loading || !config'
                desc='Loading'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else>
                <div class='mx-2 my-2'>
                    <TablerEnum
                        v-if='config.providers.length'
                        v-model='routePlan.provider'
                        label='Routing Provider'
                        :options='config.providers.map(p => p.name)'
                    />
                </div>
                <div class='mx-2 my-2'>
                    <SearchBox
                        label='Start Location'
                        placeholder='Start Location'
                        :autofocus='true'
                        @select='routePlan.start = $event || null'
                    />
                </div>
                <div class='mx-2 my-2'>
                    <SearchBox
                        label='End Location'
                        placeholder='End Location'
                        :autofocus='false'
                        @select='routePlan.end = $event || null'
                    />
                </div>

                <div class='mx-2 my-2'>
                    <TablerEnum
                        v-if='modes.length > 0'
                        v-model='routePlan.travelMode'
                        label='Travel Mode'
                        :options='modes.map(m => m.name)'
                    />
                </div>
                <div class='mx-2 my-3'>
                    <button
                        :disabled='!routePlan.start || !routePlan.end'
                        class='btn btn-primary w-100'
                        @click='generateRoute'
                    >
                        Generate Route
                    </button>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SearchBox from '../util/SearchBox.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerEnum,
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import { std, stdurl, server } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import type { Search, FeatureCollection } from '../../../types.ts';

const router = useRouter();
const mapStore = useMapStore();

const loading = ref(true);

const routePlan = ref<{
    provider: string;
    start: null | {
        name: string;
        coordinates: [number, number]
    };
    end: null | {
        name: string;
        coordinates: [number, number]
    }
    travelMode: string;
}>({
    provider: '',
    start: null,
    end: null,
    travelMode: ''
});

const error = ref<Error | undefined>();
const config = ref<Search["route"]>();

const modes = computed(() => {
    if (!config.value) return [];

    for (const p of config.value.providers) {
        if (p.name === routePlan.value.provider) {
            return p.modes;
        }
    }

    return [];
});

onMounted(async () => {
    await settings();
});

async function settings() {
    const res = await server.GET('/api/search');

    try  {
        if (res.error) throw new Error(res.error.message);
        config.value = res.data.route;

        routePlan.value.provider = config.value.providers[0].name;

        if (config.value.providers[0].modes.length > 0) {
            routePlan.value.travelMode = config.value.providers[0].modes[0].name;
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function generateRoute(): Promise<void> {
    if (!routePlan.value.start || !routePlan.value.end) {
        return;
    }

    loading.value = true;

    try {
        const url = stdurl('/api/search/route');
        url.searchParams.set('start', routePlan.value.start.coordinates.join(','));
        url.searchParams.set('end', routePlan.value.end.coordinates.join(','));
        url.searchParams.set('callsign', routePlan.value.start.name + ' to ' + routePlan.value.end.name);
        
        // Convert Human Name => ID
        if (config.value) {
            for (const p of config.value.providers) {
                if (p.name === routePlan.value.provider) {
                    url.searchParams.set('provider', p.id);
                    break;
                }
            }
        }

        // Convert Human Name => ID
        if (routePlan.value.travelMode) {
            for (const m of modes.value) {
                if (m.name === routePlan.value.travelMode) {
                    url.searchParams.set('travelMode', m.id);
                    break;
                }
            }
        }

        const route = await std(url) as FeatureCollection;

        if (route.features.length > 0) {
            const cot = await mapStore.worker.db.add(route.features[0]);

            cot.flyTo();

            router.push(`/cot/${cot.id}`);
        } else {
            throw new Error('No Route Found');
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

</script>

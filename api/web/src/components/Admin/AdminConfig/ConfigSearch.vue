<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Search Providers'
    >
        <template #icon>
            <IconMapSearch
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
        </template>
        <div class='col-lg-12 py-2 px-2'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />

                <div class='text-secondary small px-2 pb-2'>
                    Enable one or more providers for forward & reverse geocoding.
                    The first active provider is used by default and changes take effect after the API restarts.
                </div>

                <component
                    :is='provider.component'
                    v-for='provider in providers'
                    :key='provider.id'
                    :status='status(provider.id)'
                />
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang='ts'>
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { IconMapSearch } from '@tabler/icons-vue';
import { ref, watch, onMounted, markRaw } from 'vue';
import type { Component } from 'vue';
import { server } from '../../../std.ts';
import type { Search, SearchProviderStatus } from '../../../types.ts';
import SearchAgol from '../Search/SearchAgol.vue';
import SearchOsm from '../Search/SearchOsm.vue';
import {
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const providers: Array<{ id: string, component: Component }> = [
    { id: 'agol', component: markRaw(SearchAgol) },
    { id: 'osm', component: markRaw(SearchOsm) },
];

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const err = ref<Error | null>(null);
const search = ref<Search | undefined>(undefined);

onMounted(() => {
    if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState) void fetch();
});

function status(id: string): SearchProviderStatus | undefined {
    if (!search.value) return undefined;

    const forward = search.value.forward.providers.map(provider => provider.id);
    const reverse = search.value.reverse.providers.map(provider => provider.id);

    const active = [...forward, ...reverse];

    return {
        active: active.includes(id),
        default: active[0] === id,
        forward: forward.includes(id),
        reverse: reverse.includes(id),
    };
}

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const res = await server.GET('/api/search');
        if (res.error) throw new Error(res.error.message);
        search.value = res.data;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}
</script>

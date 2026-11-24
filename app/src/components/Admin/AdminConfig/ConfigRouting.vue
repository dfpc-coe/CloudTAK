<template>
    <div>
        <div class='col-lg-12 py-2 px-2'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />

                <div class='text-secondary small px-2 pb-2'>
                    Enable one or more providers for routing. Routing providers are configured independently of Search providers.
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
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, markRaw } from 'vue';
import type { Component } from 'vue';
import { server } from '../../../std.ts';
import type { Search, RoutingProviderStatus } from '../../../types.ts';
import RoutingAgol from '../Routing/RoutingAgol.vue';
import {
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const providers: Array<{ id: string, component: Component }> = [
    { id: 'agol', component: markRaw(RoutingAgol) },
];

const loading = ref<boolean>(false);
const err = ref<Error | null>(null);
const routing = ref<Search['route'] | undefined>(undefined);

onMounted(() => {
    void fetch();
});

function status(id: string): RoutingProviderStatus | undefined {
    if (!routing.value) return undefined;

    const provider = routing.value.providers.find(provider => provider.id === id);

    return {
        active: !!provider,
        default: routing.value.providers[0]?.id === id,
        modes: provider ? provider.modes.length : 0,
    };
}

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const res = await server.GET('/api/search');
        if (res.error) throw new Error(res.error.message);
        routing.value = res.data.route;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}
</script>

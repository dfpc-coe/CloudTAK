<template>
    <MenuTemplate
        name='Routes'
        :loading='!mapStore.isLoaded'
    >
        <template #buttons>
            <TablerIconButton
                v-if='routeCreation'
                title='New Route'
                @click='router.push("/menu/routes/new")'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='refresh(true)'
            />
        </template>
        <template #default>
            <div class='mx-2 my-2'>
                <TablerInput
                    v-model='query.filter'
                    icon='search'
                    placeholder='Search'
                />
            </div>
            <TablerLoading
                v-if='loading'
                v-model='query.filter'
                desc='Loading Features'
            />
            <TablerNone
                v-else-if='routes.size === 0'
                :create='false'
                label='Routes'
            />
            <template v-else>
                <div
                    v-for='cot of routes.values()'
                    :key='cot.id'
                >
                    <div
                        class='col-12 py-2 px-3 d-flex align-items-center hover user-select-none cursor-pointer'
                        @click='clickRoute(cot)'
                    >
                        <div class='col-auto'>
                            <IconRoute
                                :size='32'
                                :color='cot.properties["stroke"] || "#ffffff"'
                                stroke='1'
                            />
                        </div>
                        <div class='col-auto'>
                            <div
                                class='col-12 text-truncate px-2'
                                style='max-width: 250px;'
                                v-text='cot.properties.callsign'
                            />
                            <div class='col-12 subheader'>
                                <span
                                    v-if='cot.geometry.type === "LineString"'
                                    class='mx-2'
                                    v-text='Math.round(cot.length() * 1000) / 1000 + " km"'
                                />
                            </div>
                        </div>
                        <div class='col-auto ms-auto'>
                            <div class='d-flex btn-list'>
                                <TablerDelete
                                    displaytype='icon'
                                    @delete='deleteRoute(cot.id)'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import COT from '../../../base/cot.ts';
import { server } from '../../../std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerInput,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconPlus,
    IconRoute,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const router = useRouter();
const mapStore = useMapStore();

const channel = new BroadcastChannel("cloudtak");

channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === WorkerMessageType.Feature_Archived_Added) {
        await refresh();
    } else if (msg.type === WorkerMessageType.Feature_Archived_Removed) {
        await refresh();
    }
}

const routes = ref<Set<COT>>(new Set());
const query = ref({
    filter: ''
})

const routeCreation = ref(false);

const loading = ref(true);

watch(query.value, async () => {
    await refresh();
})

onMounted(async () => {
    await refresh();
    await settings();
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }
})

async function settings() {
    try {
        const { data, error } = await server.GET('/api/search');
        if (error) throw new Error(error.message);

        if (data.route.enabled && data.route.providers) {
            routeCreation.value = true;
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteRoute(id: string): Promise<void> {
    await mapStore.worker.db.remove(id);
    await refresh();
}

async function clickRoute(cot: COT): Promise<void> {
    cot.flyTo();

    router.push(`/cot/${cot.id}`);
}

async function refresh(load = false): Promise<void> {
    if (load) loading.value = true;

    routes.value = new Set(Array.from(await mapStore.worker.db
        .filter(`
            properties.archived
            and properties.type = "b-m-r"
            and $contains($lowercase(properties.callsign), "${query.value.filter.toLowerCase()}")
        `)))

    loading.value = false
}

</script>

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
                <div class='col-12 d-flex flex-column gap-2 p-3'>
                    <StandardItem
                        v-for='cot of routes.values()'
                        :key='cot.id'
                        class='d-flex align-items-center gap-3 p-2'
                        @click='clickRoute(cot)'
                    >
                        <div
                            class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                            style='width: 3rem; height: 3rem; min-width: 3rem;'
                        >
                            <IconRoute
                                :size='24'
                                :color='cot.properties["stroke"] || "#ffffff"'
                                stroke='1'
                            />
                        </div>

                        <div class='d-flex flex-column'>
                            <div class='fw-bold'>
                                {{ cot.properties.callsign }}
                            </div>
                            <div
                                v-if='cot.geometry.type === "LineString"'
                                class='text-secondary small'
                            >
                                {{ Math.round(cot.length() * 1000) / 1000 + " km" }}
                            </div>
                        </div>

                        <div class='d-flex btn-list ms-auto'>
                            <TablerDelete
                                displaytype='icon'
                                @delete='deleteRoute(cot.id)'
                            />
                        </div>
                    </StandardItem>
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
import StandardItem from '../util/StandardItem.vue';
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
        `, {
            mission: true
        })))

    loading.value = false
}

</script>

<template>
    <MenuTemplate
        name='Saved Features'
        :loading='!mapStore.isLoaded'
    >
        <template #buttons>
            <TablerIconButton
                title='Refresh'
                :size='24'
                @click='refresh'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div class='mx-2 my-2'>
                <TablerInput
                    icon='search'
                    v-model='query.filter'
                    placeholder='Search'
                />
            </div>
            <TablerLoading
            v-if='loading'
                desc='Loading Features'
                v-model='query.filter'
            />
            <TablerNone
                v-if='cots.length === 0'
                :create='false'
                label='Archived Features'
            />
            <template v-else>
                <template
                    v-for='path of paths'
                    :key='path'
                >
                    <div
                        class='d-flex align-items-center px-3 py-2 me-2 hover-button cursor-pointer user-select-none'
                        @click='path.opened ? closePath(path) : openPath(path)'
                    >
                        <IconChevronRight
                            v-if='!path.opened'
                            :size='20'
                            stroke='1'
                        />
                        <IconChevronDown
                            v-else
                            :size='20'
                            stroke='1'
                        />
                        <IconFolder
                            class='mx-2'
                            :size='20'
                            stroke='2'
                        />
                        <span v-text='path.name.replace(/(^\/|\/$)/g, "")' />
                    </div>
                    <div
                        v-if='path.opened'
                        class='ms-2'
                    >
                        <TablerLoading v-if='path.loading' />
                        <template v-else>
                            <Feature
                                v-for='cot of path.cots.values()'
                                :key='cot.id'
                                :feature='cot'
                            />
                        </template>
                    </div>
                </template>

                <Feature
                    v-for='cot of cots'
                    :key='cot.id'
                    :delete-button='true'
                    :info-button='true'
                    :feature='cot'
                />
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import COT from '../../../base/cot.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import Feature from '../util/Feature.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconFolder,
    IconRefresh,
    IconChevronRight,
    IconChevronDown
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

type Path = {
    name: string;
    opened: boolean;
    loading: boolean;
    cots: Set<COT>;
};

const channel = new BroadcastChannel("cloudtak");

channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === WorkerMessageType.Feature_Archived_Added) {
        await refresh();
    }
}

const cots = ref<COT[]>([]);
const paths = ref<Array<Path>>();
const query = ref({
    filter: ''
})
const loading = ref(true);

watch(query.value, async () => {
    await refresh();
})

onMounted(async () => {
    await refresh();
    loading.value = false
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }
})

async function refresh(): Promise<void> {
    cots.value = Array.from(await mapStore.worker.db
        .filter(`
            properties.archived
            and $contains($lowercase(properties.callsign), "${query.value.filter.toLowerCase()}")
        `))

    paths.value = (await mapStore.worker.db.paths())
        .map(p => p.path)
        .sort((a) => {
            return a === '/' ? 1 : -1;
        }).filter((path) => {
            return path !== '/'
        }).map((path) => {
            return {
                name: path,
                opened: false,
                loading: false,
                cots: new Set()
            }
        });
}

async function closePath(path: Path): Promise<void> {
    path.opened = false;
}

async function openPath(path: Path): Promise<void> {
    path.opened = true;
    path.loading = true;
    path.cots = await mapStore.worker.db.pathFeatures(path.name);
    path.loading = false;
}

</script>

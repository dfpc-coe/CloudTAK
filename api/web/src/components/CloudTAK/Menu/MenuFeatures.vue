<template>
    <MenuTemplate
        name='Saved Features'
        :loading='!mapStore.isLoaded'
    >
        <template #buttons>
            <TablerDropdown>
                <TablerIconButton
                    title='Export'
                >
                    <IconDownload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <template #dropdown>
                    <div
                        class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2 py-2'
                        @click.stop.prevent='download("geojson")'
                    >
                        <IconFile
                            :size='32'
                            stroke='1'
                        />
                        <span class='mx-2'>GeoJSON</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2 py-2'
                        @click.stop.prevent='download("kml")'
                    >
                        <IconFile
                            :size='32'
                            stroke='1'
                        />
                        <span class='mx-2'>KML</span>
                    </div>
                </template>
            </TablerDropdown>

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
                                :delete-button='true'
                                :info-button='true'
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
import { stdurl } from '../../../std.ts';
import COT from '../../../base/cot.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import Feature from '../util/Feature.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconFile,
    IconFolder,
    IconDownload,
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
    } else if (msg.type === WorkerMessageType.Feature_Archived_Removed) {
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
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }
})

async function refresh(load = false): Promise<void> {
    if (load) loading.value = true;

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

    loading.value = false
}

async function download(format: string) {
    window.location.href = String(stdurl(`/api/profile/feature?format=${format}&download=true&token=${localStorage.token}`));
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

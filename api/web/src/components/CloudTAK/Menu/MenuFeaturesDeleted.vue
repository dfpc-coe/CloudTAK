<template>
    <MenuTemplate
        name='Deleted Features'
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
                        class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
                        @click.stop.prevent='download("geojson")'
                    >
                        <IconFile
                            :size='32'
                            stroke='1'
                        />
                        <span class='mx-2'>GeoJSON</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
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
                @click='refresh'
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
                desc='Loading Deleted Features'
            />
            <TablerNone
                v-else-if='filteredList.length === 0'
                :create='false'
                label='Archived Features'
            />
            <template v-else>
                <GenericSelect
                    ref='select'
                    role='menu'
                    :disabled='false'
                    :hover='false'
                    :items='filteredList'
                >
                    <template #buttons='{disabled}'>
                        <TablerIconButton
                            :disabled='disabled'
                            @click='restoreFeatures'
                        >
                            <IconRestore
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </template>
                    <template #item='{ item }'>
                        <FeatureRow
                            :id='item.id'
                            :select='false'
                            :grip-handle='false'
                            :delete-button='false'
                            :info-button='false'
                            :feature='item'
                        />
                    </template>
                </GenericSelect>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed, useTemplateRef } from 'vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import FeatureRow from '../util/FeatureRow.vue';
import GenericSelect from '../util/GenericSelect.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import { std, server } from '../../../std.ts';
import type { ComponentExposed } from 'vue-component-type-helpers'
import type { FeatureCollection } from '../../../types.ts';
import {
    IconFile,
    IconRestore,
    IconDownload,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const list = ref<FeatureCollection>({
    type: 'FeatureCollection',
    features: []
});

const query = ref({
    filter: '',
    page: 0,
    deleted: true,
    download: false,
    limit: 100
})

const loading = ref(true);
const select = useTemplateRef<ComponentExposed<typeof GenericSelect>>('select');

const filteredList = computed(() => {
    if (query.value.filter === '') return list.value.features;

    return list.value.features.filter((feature) => {
        return feature.properties.callsign.toLowerCase().includes(query.value.filter.toLowerCase())
    });
});

onMounted(async () => {
    await refresh();
});

async function refresh() {
    loading.value = true;

    try {
        const res = await server.GET('/api/profile/feature', {
            params: {
                query: {
                    sort: 'id',
                    order: 'desc',
                    page: query.value.page,
                    download: query.value.download,
                    deleted: query.value.deleted,
                    format: 'geojson',
                    limit: query.value.limit
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        list.value.features = res.data.items.map((feat) => {
            return {
                id: feat.id,
                type: feat.type,
                path: feat.path,
                properties: {
                    id: feat.id,
                    ...feat.properties
                },
                geometry: feat.geometry
            }
        });

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function restoreFeatures(): Promise<void> {
    if (!select.value) return;
    const selected = select.value.selected;

    loading.value = true;

    for (const feature of list.value.features) {
        if (selected.has(feature.id)) {
            await mapStore.worker.db.add(JSON.parse(JSON.stringify(feature)), {
                authored: true
            });
        }
    }

    // TODO: Improve this to not be a timeout, the API operations can occasionally return the feature
    setTimeout(async () => {
        await refresh();
    }, 500);
}

async function download(format: string): Promise<void> {
    await std(`/api/profile/feature?format=${format}&download=true&token=${localStorage.token}&deleted=true`, {
        download: true
    });
}
</script>

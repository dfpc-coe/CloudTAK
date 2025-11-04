<template>
    <MenuTemplate
        name='Overlay Explorer'
    >
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div class='row g-0 py-2'>
                <div class='col-12 px-2'>
                    <button
                        class='btn btn-primary w-100'
                        @click='router.push("/menu/files")'
                    >
                        <IconUser
                            :size='32'
                            stroke='1'
                        />Your Files
                    </button>
                </div>
            </div>

            <div class='col-12 px-2 pb-2'>
                <TablerInput
                    icon='search'
                    placeholder='Search Overlays...'
                    v-model='paging.filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerNone
                    v-if='!list.total'
                    label='Server Overlays'
                    :create='false'
                />
                <template v-else>
                    <div
                        v-for='ov in list.items'
                        :key='ov.id'
                        class='cursor-pointer col-12 py-2 px-3 hover rounded'
                        @click='createOverlay(ov)'
                    >
                        <div class='col-12 py-2 px-2 d-flex align-items-center'>
                            <span
                                class='mx-2'
                                v-text='ov.name'
                            />

                            <div class='ms-auto'>
                                <span
                                    v-if='!ov.username'
                                    class='badge border bg-blue text-white'
                                >Public</span>
                                <span
                                    v-else
                                    class='badge border bg-red text-white'
                                >Private</span>
                            </div>
                        </div>
                    </div>
                </template>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Basemap, BasemapList } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconUser,
} from '@tabler/icons-vue'
import Overlay from '../../../base/overlay.ts';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();
const router = useRouter();

const loading = ref(false);

const paging = ref({
    filter: '',
    limit: 30,
    page: 0
});

const list = ref<BasemapList>({
    total: 0,
    collections: [],
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});


onMounted(async () => {
    await fetchList();
});

async function createOverlay(overlay: Basemap) {
    loading.value = true;

    try {
        await mapStore.overlays.push(await Overlay.create({
            url: String(stdurl(`/api/basemap/${overlay.id}/tiles`)),
            name: overlay.name,
            mode: 'overlay',
            mode_id: String(overlay.id),
            frequency: overlay.frequency,
            type: overlay.type,
            styles: overlay.styles
        }));

        loading.value = false;

        router.push('/menu/overlays');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchList() {
    loading.value = true;
    const url = stdurl('/api/basemap');
    if (paging.value.filter) url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('overlay', 'true');
    url.searchParams.append('limit', String(paging.value.limit));
    url.searchParams.append('page', String(paging.value.page));
    list.value = await std(url) as BasemapList;
    loading.value = false;
}
</script>

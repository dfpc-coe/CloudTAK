<template>
    <MenuTemplate name='User Files'>
        <template #buttons>
            <TablerIconButton
                v-if='!loading && !upload'
                title='New Import'
                @click='upload = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div
                v-if='upload'
                class='py-2 px-4'
            >
                <Upload
                    :url='stdurl(`/api/import`)'
                    :headers='uploadHeaders()'
                    method='PUT'
                    @cancel='upload = false'
                    @done='uploadComplete($event)'
                />
            </div>

            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading
                v-if='loading'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.assets.length'
                label='Imports'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='asset in list.assets'
                    :key='asset.name'
                >
                    <div class='col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                        <div class='col-auto'>
                            <IconMapPlus
                                v-if='asset.visualized'
                                v-tooltip='"Add to Map"'
                                class='cursor-pointer'
                                :size='32'
                                stroke='1'
                                @click='createOverlay(asset)'
                            />
                            <IconMapOff
                                v-else
                                v-tooltip='"Not Cloud Optimized"'
                                :size='32'
                                stroke='1'
                            />
                        </div>
                        <div class='col-auto'>
                            <div
                                class='col-12 text-truncate px-2'
                                style='max-width: 250px;'
                                v-text='asset.name'
                            />
                            <div class='col-12 subheader'>
                                <span class='mx-2'>
                                    <TablerBytes :bytes='asset.size' /> - <TablerEpoch :date='asset.updated' />
                                </span>
                            </div>
                        </div>
                        <div class='col-auto ms-auto'>
                            <div class='d-flex btn-list'>
                                <TablerDelete
                                    v-tooltip='"Delete Asset"'
                                    displaytype='icon'
                                    @delete='deleteAsset(asset)'
                                />
                                <TablerIconButton
                                    title='Download Asset'
                                    @click='downloadAsset(asset)'
                                >
                                    <IconDownload
                                        :size='32'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <div class='px-2 py-2 d-flex'>
                <div class='ms-auto'>
                    <TablerPager
                        v-if='list.total > paging.limit'
                        :page='paging.page'
                        :total='list.total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, onMounted, watch } from 'vue';
import { std, stdurl } from '../../../std.ts';
import {
    TablerDelete,
    TablerIconButton,
    TablerRefreshButton,
    TablerAlert,
    TablerNone,
    TablerPager,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconMapOff,
    IconMapPlus,
    IconTransform,
    IconDownload,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '/src/stores/map.ts';
import Overlay from '../../../base/overlay.ts';
import Upload from '../../util/Upload.vue';

const mapStore = useMapStore();

const router = useRouter();
const upload = ref(false)
const error = ref(undefined);
const loading = ref(true);
const transform = ref({});

const paging = ref({
    limit: 20,
    page: 0
});

const list = ref({
    assets: []
});

watch(paging.value, async () => {
    await fetchList()
});

onMounted(async () => {
    await fetchList();
});

async function createOverlay(asset) {
    const url = stdurl(`/api/profile/asset/${encodeURIComponent(asset.visualized)}/tile`);

    loading.value = true;
    const res = await std(url);

    if (new URL(res.tiles[0]).pathname.endsWith('.mvt')) {
        await mapStore.overlays.push(await Overlay.create(mapStore.map, {
            url,
            name: asset.name,
            mode: 'profile',
            mode_id: asset.name,
            type: 'vector',
        }));
    } else {
        await mapStore.overlays.push(await Overlay.create(mapStore.map, {
            url: url,
            name: asset.name,
            mode: 'profile',
            mode_id: asset.name,
            type: 'raster',
        }));
    }

    loading.value = false;

    router.push('/menu/overlays');
}

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

function uploadComplete(event: string) {
    upload.value = false;
    const imp = JSON.parse(event) as { imports: Array<{ uid: string }> };
    router.push(`/menu/imports/${imp.imports[0].uid}`)
}

async function downloadAsset(asset) {
    const url = stdurl(`/api/profile/asset/${asset.name}`);
    url.searchParams.append('token', localStorage.token);
    window.open(url, "_blank")
}

async function fetchList() {
    try {
        loading.value = true;
        error.value = undefined;
        list.value = await std(`/api/profile/asset`);
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deleteAsset(asset) {
    loading.value = true;
    await std(`/api/profile/asset/${asset.name}`, {
        method: 'DELETE'
    });

    await fetchList();
}
</script>

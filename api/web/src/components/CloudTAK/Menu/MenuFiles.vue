<template>
    <MenuTemplate name='User Files'>
        <template #buttons>
            <TablerIconButton
                v-if='!loading && !upload'
                title='File Upload'
                @click='upload = true'
            >
                <IconUpload
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
                    <div
                        class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover'
                        @click='opened.has(asset.name) ? opened.delete(asset.name) : opened.add(asset.name)'
                    >
                        <div class='col-auto'>
                            <IconMapPlus
                                v-if='asset.visualized'
                                :size='32'
                                stroke='1'
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
                                class='col-12 text-truncate px-2 user-select-none'
                                style='max-width: 250px;'
                                v-text='asset.name'
                            />
                            <div class='col-12 subheader'>
                                <span class='mx-2 user-select-none'>
                                    <TablerBytes :bytes='asset.size' /> - <TablerEpoch :date='asset.updated' />
                                </span>
                            </div>
                        </div>
                    </div>

                    <div
                        v-if='opened.has(asset.name)'
                        class='pt-1 mx-4'
                    >
                        <div class='rounded bg-child'>
                            <div
                                v-if='asset.visualized'
                                class='cursor-pointer rounded-top col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                @click.stop.prevent='createOverlay(asset)'
                            >
                                <IconMapPlus
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Add to Map as Overlay</span>
                            </div>
                            <div
                                v-else
                                class='rounded-top col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                            >
                                <IconMapOff
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Cannot Add to Map - Unsupported Format</span>
                            </div>

                            <div
                                class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                @click.stop.prevent='downloadAsset(asset)'
                            >
                                <IconDownload
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Download Original</span>
                            </div>
                            <div
                                class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                @click.stop.prevent='shareToPackage = asset.name'
                            >
                                <IconPackage
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Create Data Package</span>
                            </div>

                            <TablerDelete
                                displaytype='menu'
                                class='hover rounded-bottom'
                                label='Delete File'
                                @delete='deleteAsset(asset)'
                            />
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>

    <ShareToPackage
        v-if='shareToPackage'
        :name='shareToPackage'
        :assets='[{
            type: "profile",
            name: shareToPackage
        }]'
        @close='shareToPackage = undefined'
    />
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, onMounted } from 'vue';
import type { ProfileAsset, ProfileAssetList } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import {
    TablerDelete,
    TablerIconButton,
    TablerRefreshButton,
    TablerAlert,
    TablerNone,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';
import {
    IconPackage,
    IconUpload,
    IconMapOff,
    IconMapPlus,
    IconDownload,
} from '@tabler/icons-vue';
import ShareToPackage from '../util/ShareToPackage.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '../../../stores/map.ts';
import Overlay from '../../../base/overlay.ts';
import Upload from '../../util/Upload.vue';

const mapStore = useMapStore();

const router = useRouter();
const upload = ref(false)
const opened = ref<Set<string>>(new Set());
const shareToPackage = ref<string | undefined>();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);

const list = ref<ProfileAssetList>({
    total: 0,
    tiles: { url: '' },
    assets: [],
});

onMounted(async () => {
    await fetchList();
});

async function createOverlay(asset: ProfileAsset) {
    if (!asset.visualized) throw new Error('Cannot add an Overlay for an asset that is not Cloud Optimized');

    const url = stdurl(`/api/profile/asset/${encodeURIComponent(asset.visualized)}/tile`);

    loading.value = true;

    // TODO type PMTiles endpoints
    const res = await std(url) as {
        tiles: [ string ];
    };

    if (new URL(res.tiles[0]).pathname.endsWith('.mvt')) {
        await mapStore.overlays.push(await Overlay.create(mapStore.map, {
            url: String(url),
            name: asset.name,
            mode: 'profile',
            mode_id: asset.name,
            type: 'vector',
        }));
    } else {
        await mapStore.overlays.push(await Overlay.create(mapStore.map, {
            url: String(url),
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

async function downloadAsset(asset: ProfileAsset) {
    const url = stdurl(`/api/profile/asset/${asset.name}`);
    url.searchParams.append('token', localStorage.token);
    window.open(url, "_blank")
}

async function fetchList() {
    try {
        loading.value = true;
        error.value = undefined;
        list.value = await std(`/api/profile/asset`) as ProfileAssetList;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deleteAsset(asset: ProfileAsset) {
    loading.value = true;
    await std(`/api/profile/asset/${asset.name}`, {
        method: 'DELETE'
    });

    await fetchList();
}
</script>

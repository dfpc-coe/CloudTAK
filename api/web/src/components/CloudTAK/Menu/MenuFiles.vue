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

            <div class='col-12 pe-2 pt-2'>
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
                v-else-if='!list.items.length'
                label='Uploaded Files'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='asset in list.items'
                    :key='asset.id'
                    role='menu'
                >
                    <TablerSlidedown
                        :click-anywhere-expand='true'
                        :arrow='false'
                        class='my-2 me-2'
                    >
                        <template #default>
                            <div
                                class='d-flex align-items-center'
                                role='menuitem'
                                tabindex='0'
                            >
                                <div class='col-auto'>
                                    <IconMapPlus
                                        v-if='asset.artifacts.map(a => a.ext).includes(".pmtiles")'
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
                        </template>
                        <template #expanded>
                            <div
                                v-if='asset.artifacts.map(a => a.ext).includes(".pmtiles")'
                                class='cursor-pointer rounded col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                role='menuitem'
                                tabindex='0'
                                @click.stop.prevent='createOverlay(asset)'
                                @keyup.enter='createOverlay(asset)'
                            >
                                <IconMapPlus
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Add to Map as Overlay</span>
                            </div>
                            <div
                                v-else
                                role='menuitem'
                                class='rounded col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                            >
                                <IconMapOff
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Cannot Add to Map - Unsupported Format</span>
                            </div>

                            <div
                                class='cursor-pointer rounded col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                @click.stop.prevent='downloadAsset(asset)'
                            >
                                <IconDownload
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Download Original</span>
                            </div>
                            <div
                                class='cursor-pointer rounded col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                role='menuitem'
                                tabindex='0'
                                @click.stop.prevent='shareToMission = asset'
                                @keyup.enter='shareToMission = asset'
                            >
                                <IconAmbulance
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Add to Data Sync</span>
                            </div>
                            <div
                                class='cursor-pointer rounded col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                role='menuitem'
                                tabindex='0'
                                @click.stop.prevent='shareToPackage = asset'
                                @keyup.enter='shareToPackage = asset'
                            >
                                <IconPackage
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Create Data Package</span>
                            </div>
                            <div
                                class='cursor-pointer rounded col-12 hover d-flex align-items-center px-2 py-2 user-select-none'
                                role='menuitem'
                                tabindex='0'
                                @click.stop.prevent='rename = { id: asset.id, name: asset.name, loading: false }'
                                @keyup.enter='rename = { id: asset.id, name: asset.name, loading: false }'
                            >
                                <IconCursorText
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='mx-2'>Rename File</span>
                            </div>

                            <div v-if='rename && rename.id === asset.id'>
                                <TablerInput
                                    v-model='rename.name'
                                    class='m-2'
                                    :placeholder='asset.name'
                                    :autofocus='true'
                                    @blur='rename = undefined'
                                    @keyup.enter='renameAsset'
                                />
                            </div>

                            <TablerDelete
                                displaytype='menu'
                                class='hover rounded'
                                label='Delete File'
                                @delete='deleteAsset(asset)'
                            />
                        </template>
                    </TablerSlidedown>
                </div>

                <div class='col-12 d-flex justify-content-center pt-3'>
                    <TablerPager
                        v-if='list.total > paging.limit'
                        :page='paging.page'
                        :total='list.total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </template>
        </template>
    </MenuTemplate>

    <ShareToMission
        v-if='shareToMission'
        :assets='[{
            type: "profile",
            id: shareToMission.id,
            name: shareToMission.name
        }]'
        @close='shareToMission = undefined'
    />

    <ShareToPackage
        v-if='shareToPackage'
        :name='shareToPackage.name'
        :assets='[{
            type: "profile",
            id: shareToPackage.id,
            name: shareToPackage.name
        }]'
        @close='shareToPackage = undefined'
    />
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, watch, onMounted } from 'vue';
import type { ProfileFile, ProfileFileList } from '../../../types.ts';
import { std, stdurl, server } from '../../../std.ts';
import {
    TablerDelete,
    TablerIconButton,
    TablerRefreshButton,
    TablerSlidedown,
    TablerInput,
    TablerPager,
    TablerAlert,
    TablerNone,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';
import {
    IconAmbulance,
    IconPackage,
    IconUpload,
    IconMapOff,
    IconMapPlus,
    IconDownload,
    IconCursorText
} from '@tabler/icons-vue';
import ShareToPackage from '../util/ShareToPackage.vue';
import ShareToMission from '../util/ShareToMission.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '../../../stores/map.ts';
import Overlay from '../../../base/overlay.ts';
import Upload from '../../util/Upload.vue';

const mapStore = useMapStore();

const router = useRouter();
const upload = ref(false)
const shareToPackage = ref<ProfileFile | undefined>();
const shareToMission = ref<ProfileFile | undefined>();
const rename = ref<{
    id: string;
    loading: boolean;
    name: string;
} | undefined>();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);

const list = ref<ProfileFileList>({
    total: 0,
    tiles: { url: '' },
    items: [],
});

const paging = ref({
    page: 0,
    filter: '',
    limit: 20
})

onMounted(async () => {
    await fetchList();
});

watch(paging.value, async () => {
    await fetchList();
});

async function createOverlay(asset: ProfileFile) {
    if (!asset.artifacts.map(a => a.ext).includes(".pmtiles")) throw new Error('Cannot add an Overlay for an asset that is not Cloud Optimized');

    const url = stdurl(`/api/profile/asset/${encodeURIComponent(asset.id)}.pmtiles/tile`);

    loading.value = true;

    // TODO type PMTiles endpoints
    const res = await std(url) as {
        tiles: [ string ];
    };

    if (new URL(res.tiles[0]).pathname.endsWith('.mvt')) {
        await mapStore.overlays.push(await Overlay.create({
            url: String(url),
            name: asset.name,
            mode: 'profile',
            mode_id: asset.name,
            iconset: asset.iconset,
            type: 'vector',
        }));
    } else {
        await mapStore.overlays.push(await Overlay.create({
            url: String(url),
            name: asset.name,
            mode: 'profile',
            mode_id: asset.name,
            iconset: asset.iconset,
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

function uploadComplete(event: unknown) {
    upload.value = false;
    const imp = event as { imports: Array<{ uid: string }> };
    router.push(`/menu/imports/${imp.imports[0].uid}`)
}

async function downloadAsset(asset: ProfileFile) {
    const url = stdurl(`/api/profile/asset/${asset.id}.${asset.name.split('.').pop()}`);
    url.searchParams.append('token', localStorage.token);
    window.open(url, "_blank")
}

async function renameAsset() {
    if (!rename.value) return;

    rename.value.loading = true;

    try {
        const res = await server.PATCH('/api/profile/asset/{:asset}', {
            params: {
                path: {
                    ':asset': rename.value.id
                },
            },
            body: {
                name: rename.value.name
            }
        });

        if (res.error) throw new Error(res.error.message);

        for (const item of list.value.items) {
            if (item.id === rename.value.id) {
                item.name = rename.value.name;
                break;
            }
        }

        rename.value = undefined;
    } catch (err) {
        if (rename.value) rename.value.loading = false;
        throw err;
    }
}

async function fetchList() {
    try {
        loading.value = true;
        error.value = undefined;

        const res = await server.GET(`/api/profile/asset`, {
            params: {
                query: {
                    filter: paging.value.filter,
                    order: 'desc',
                    sort: 'created',
                    limit: paging.value.limit,
                    page: paging.value.page
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deleteAsset(asset: ProfileFile) {
    loading.value = true;

    try {
        const res = await server.DELETE('/api/profile/asset/{:asset}', {
            params: {
                path: {
                    ':asset': asset.id
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
    } catch (err) {
        loading.value = false
        throw err;
    }

    await fetchList();
}
</script>

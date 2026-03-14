<template>
    <div>
        <div class='card-header d-flex'>
            <h3 class='card-title'>
                Data Assets
            </h3>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"Upload"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='upload = true'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </div>
        </div>

        <div
            v-if='!err && !upload && !loading.list && list.assets.length'
            class='table-responsive'
        >
            <table class='table table-hover table-vcenter card-table'>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='asset in list.assets'
                        :key='asset.name'
                    >
                        <td>
                            <div class='d-flex align-items-center'>
                                <div class='btn-list'>
                                    <IconMap
                                        v-if='asset.visualized'
                                        v-tooltip='"Visualizable"'
                                        :size='32'
                                        stroke='1'
                                    />
                                    <IconMapOff
                                        v-else
                                        v-tooltip='"Not Cloud Optimized"'
                                        size='32'
                                        stroke='1'
                                    />
                                </div>

                                <span
                                    class='mx-2'
                                    v-text='asset.name'
                                />

                                <IconRefreshDot
                                    v-if='data.mission_sync && asset.sync'
                                    v-tooltip='"Syncing"'
                                    :size='32'
                                    stroke='1'
                                    class='text-green'
                                />
                                <IconRefreshOff
                                    v-else-if='data.mission_sync && !asset.sync'
                                    :size='32'
                                    stroke='1'
                                />
                            </div>
                        </td>
                        <td>
                            <TablerBytes :bytes='asset.size' />
                        </td>
                        <td class='d-flex align-items-center'>
                            <TablerEpoch :date='asset.updated' />
                            <div class='ms-auto btn-list'>
                                <TablerDelete
                                    v-tooltip='"Delete Asset"'
                                    displaytype='icon'
                                    @delete='deleteAsset(asset)'
                                />
                                <IconDownload
                                    v-tooltip='"Download Asset"'
                                    :size='32'
                                    stroke='1'
                                    class='cursor-pointer'
                                    @click='downloadAsset(asset)'
                                />
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div
            v-else
            class='card-body'
        >
            <template v-if='err'>
                <TablerAlert
                    title='Asset Error'
                    :err='err'
                    :compact='true'
                />
            </template>
            <TablerLoading v-else-if='loading.list' />
            <Upload
                v-else-if='upload'
                :url='uploadURL()'
                :headers='uploadHeaders()'
                @cancel='upload = false'
                @done='fetchList'
            />
            <TablerNone
                v-else-if='!list.assets.length'
                :create='false'
                :compact='true'
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import {
    IconRefreshDot,
    IconRefreshOff,
    IconPlus,
    IconMap,
    IconMapOff,
    IconRefresh,
    IconDownload,
} from '@tabler/icons-vue';
import Upload from '../../util/Upload.vue';
import {
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';

type Asset = {
    name: string;
    size: number;
    updated: string;
    visualized: boolean;
    sync: boolean;
};

type AssetList = {
    total: number;
    assets: Asset[];
    tiles?: { url: string };
};

defineProps<{
    data: {
        mission_sync?: boolean;
        [key: string]: unknown;
    };
}>();

const emit = defineEmits<{
    (e: 'assets', list: AssetList): void;
}>();

const route = useRoute();

const err = ref<unknown>(null);
const upload = ref(false);
const loading = ref({ list: true });
const list = ref<AssetList>({ total: 0, assets: [] });

onMounted(async () => {
    await fetchList();
});

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

function uploadURL() {
    return stdurl(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}/asset`);
}

async function downloadAsset(asset: Asset) {
    const url = stdurl(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}/asset/${asset.name}`);
    url.searchParams.set('token', localStorage.token);
    window.open(url, '_blank');
}

async function deleteAsset(asset: Asset) {
    loading.value.list = true;
    await std(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}/asset/${asset.name}`, {
        method: 'DELETE'
    });
    await fetchList();
}

async function fetchList() {
    upload.value = false;
    try {
        loading.value.list = true;
        err.value = null;
        list.value = await std(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}/asset`) as AssetList;
        loading.value.list = false;
        emit('assets', list.value);
    } catch (e) {
        err.value = e;
    }
}
</script>

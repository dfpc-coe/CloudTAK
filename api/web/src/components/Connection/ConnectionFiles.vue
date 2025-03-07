<template>
    <div>
        <div class='card-header d-flex'>
            <h3 class='card-title'>
                Data Assets
            </h3>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Upload'
                    @click='upload = true'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Refresh'
                    @click='fetchList'
                >
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <div
            v-if='!error && !upload && !loading && list.items.length'
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
                        v-for='asset in list.items'
                        :key='asset.name'
                    >
                        <td>
                            <div class='d-flex align-items-center'>
                                <IconFile
                                    :size='32'
                                    stroke='1'
                                />

                                <span
                                    class='mx-2'
                                    v-text='asset.name'
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
            <template v-if='error'>
                <TablerAlert
                    title='Asset Error'
                    :err='error'
                    :compact='true'
                />
            </template>
            <TablerLoading v-else-if='loading' />
            <Upload
                v-else-if='upload'
                :url='uploadURL()'
                :headers='uploadHeaders()'
                @cancel='upload = false'
                @done='fetchList'
            />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                :compact='true'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import  { useRoute } from 'vue-router'
import { ref, onMounted } from 'vue';
import { std, stdurl } from '/src/std.ts';
import {
    IconPlus,
    IconFile,
    IconRefresh,
    IconDownload,
} from '@tabler/icons-vue'
import Upload from '../util/Upload.vue';
import {
    TablerIconButton,
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';

const route = useRoute();
const error = ref<Error | undefined>(undefined);
const upload = ref(false);
const loading = ref(true);
const list = ref({
    total: 0,
    assets: []
});

onMounted(async () => {
    await fetchList();
});

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

function uploadURL() {
    return stdurl(`/api/connection/${route.params.connectionid}/asset`);
}

async function downloadAsset(asset) {
    const url = stdurl(`/api/connection/${route.params.connectionid}/asset/${asset.name}`);
    url.searchParams.append('token', localStorage.token);
    window.open(url, "_blank")
}

async function deleteAsset(asset) {
    loading.value = true;
    await std(`/api/connection/${route.params.connectionid}/asset/${asset.name}`, {
        method: 'DELETE'
    });

    await fetchList();
}

async function fetchList() {
    upload.value = false;

    try {
        loading.value = true;
        error.value = undefined;
        list.value = await std(`/api/connection/${route.params.connectionid}/asset`);
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>

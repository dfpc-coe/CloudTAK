<template>
    <div>
        <div class='card-header d-flex'>
            <h3 class='card-title'>
                Connection Assets
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
                <TablerRefreshButton
                    title='Refresh'
                    :loading='loading'
                    @click='fetchList'
                />
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
import { Preferences } from '@capacitor/preferences';
import { openExternalUrl } from '../../../base/capacitor.ts';
import { server, stdurl } from '../../../std.ts';
import type { ETLConnectionAssetList } from '../../../types.ts';
import {
    IconPlus,
    IconFile,
    IconDownload,
} from '@tabler/icons-vue'
import Upload from '../../util/Upload.vue';
import {
    TablerIconButton,
    TablerRefreshButton,
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
const list = ref<ETLConnectionAssetList>({
    total: 0,
    items: []
});

onMounted(async () => {
    await fetchList();
});

function uploadURL() {
    return stdurl(`/api/connection/${route.params.connectionid}/asset`);
}

function splitAssetName(name: string): { asset: string; ext: string } {
    const idx = name.lastIndexOf('.');
    if (idx <= 0 || idx === name.length - 1) {
        throw new Error(`Unsupported asset name: ${name}`);
    }

    return {
        asset: name.slice(0, idx),
        ext: name.slice(idx + 1),
    };
}

async function downloadAsset(asset: ETLConnectionAssetList["items"][0]) {
    const { value: token } = await Preferences.get({ key: 'token' });
    const url = stdurl(`/api/connection/${route.params.connectionid}/asset/${asset.name}`);
    if (token) url.searchParams.set('token', token);
    url.searchParams.set('download', String(true));
    await openExternalUrl(url)
}

async function deleteAsset(asset: ETLConnectionAssetList["items"][0]) {
    loading.value = true;
    const parts = splitAssetName(asset.name);
    const { error } = await server.DELETE('/api/connection/{:connectionid}/asset/{:asset}.{:ext}', {
        params: {
            path: {
                ':connectionid': Number(route.params.connectionid),
                ':asset': parts.asset,
                ':ext': parts.ext,
            }
        }
    });

    if (error) throw new Error(error.message);

    await fetchList();
}

async function fetchList() {
    upload.value = false;

    try {
        loading.value = true;
        error.value = undefined;
        const { data, error: serverError } = await server.GET('/api/connection/{:connectionid}/asset', {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                }
            }
        });

        if (serverError) throw new Error(serverError.message);

        list.value = data;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>

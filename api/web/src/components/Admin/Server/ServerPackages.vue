<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                TAK Server Data Packages
            </h3>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <TablerRefreshButton
                        :loading='loading'
                        @click='fetchList'
                    />
                </div>
            </div>
        </div>
        <div class='card-body row'>
             <div class='col-12'>
                <TablerInput
                    v-model='filter'
                    placeholder='Filter Packages...'
                    :disabled='loading'
                >
                    <template #icon>
                        <IconSearch
                            :size='20'
                            stroke='1'
                        />
                    </template>
                </TablerInput>
             </div>
        </div>
        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else
            class='card-body row'
        >
            <TablerNone
                v-if='list.total === 0'
                label='Packages'
                :create='false'
            />
            <template v-else>
                <template v-for='pkg in list.items'>
                    <div class='col-12 hover d-flex align-items-center px-2 py-2 rounded'>
                        <div class='row'>
                            <div class='col-12'>
                                <span v-text='pkg.name' />
                            </div>
                            <div class='col-12 subheader'>
                                <span v-text='pkg.created' /> - <span v-text='pkg.username || ""' />
                            </div>
                        </div>
                        <div class='ms-auto btn-list'>
                            <TablerIconButton
                                title='Download Package'
                                @click='downloadPackage(pkg)'
                            >
                                <IconDownload
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerDelete
                                displaytype='icon'
                                @delete='deletePackage(pkg)'
                            />
                        </div>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue';
import { server, std, stdurl } from '../../../std.ts';
import type { ServerAdminPackageList } from '../../../types.ts';
import {
    TablerRefreshButton,
    TablerLoading,
    TablerDelete,
    TablerAlert,
    TablerNone,
    TablerInput,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconSearch,
    IconDownload
} from '@tabler/icons-vue';

const loading = ref(true);
const error = ref<Error | undefined>();
const filter = ref('');
const list = ref<ServerAdminPackageList>({
    total: 0,
    items: []
})

onMounted(async () => {
    await fetchList();
});

watch(filter, () => {
    fetchList();
});

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET(`/api/marti/package`, {
            params: {
                query: {
                    impersonate: true,
                    filter: filter.value
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function downloadPackage(pkg: ServerAdminPackageList["items"][0]) {
    const url = stdurl(`/api/marti/api/files/${pkg.hash}`)
    url.searchParams.append('token', localStorage.token);
    url.searchParams.append('name', pkg.name + '.zip');

    await std(url, {
        download: true
    });
}

async function deletePackage(pkg: ServerAdminPackageList["items"][0]) {
    loading.value = true;
    try {
        await server.DELETE(`/api/marti/package/{:uid}`, {
            params: {
                path: {
                    ':uid': pkg.uid
                },
                query: {
                    impersonate: true,
                    hash: pkg.hash
                }
            }
        });

        await fetchList();
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

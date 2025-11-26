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
                                <span v-text='pkg.Name' />
                            </div>
                            <div class='col-12 subheader'>
                                <span v-text='pkg.SubmissionDateTime' /> - <span v-text='pkg.SubmissionUser || ""' />
                            </div>
                        </div>
                        <div class='ms-auto'>
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
import { ref, onMounted } from 'vue';
import { server } from '../../../std.ts';
import type { ServerAdminPackageList } from '../../../types.ts';
import {
    TablerRefreshButton,
    TablerLoading,
    TablerDelete,
    TablerAlert,
    TablerNone,
} from '@tak-ps/vue-tabler';

const loading = ref(true);
const error = ref<Error | undefined>();
const list = ref<ServerAdminPackageList>({
    total: 0,
    items: []
})

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET(`/api/server/package`);

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deletePackage(pkg: ServerAdminPackageList["items"][0]) {
    loading.value = true;
    try {
        await server.DELETE(`/api/server/package/{:hash}`, {
            params: {
                path: {
                    ':hash': pkg.Hash
                }
            }
        })

        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

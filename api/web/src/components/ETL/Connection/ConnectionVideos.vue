<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Video
            </h3>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    displaytype='icon'
                    @delete='deleteAll'
                />
                <TablerRefreshButton
                    title='Refresh'
                    :loading='loading'
                    @click='fetch'
                />
            </div>
        </div>

        <div style='min-height: 20vh; margin-bottom: 60px'>
            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='list.total === 0'
                :create='false'
                label='Videos'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table table-hover card-table table-vcenter cursor-pointer'>
                    <thead>
                        <tr>
                            <th>Token Name</th>
                            <th>Created</th>
                            <th>Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='lease in list.items'
                            :key='lease.id'
                        >
                            <td v-text='lease.name' />
                            <td><TablerEpoch :date='+new Date(lease.created)' /></td>
                            <td><TablerEpoch :date='+new Date(lease.updated)' /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div
            class='position-absolute bottom-0 w-100'
            style='height: 60px;'
        >
            <TableFooter
                :limit='paging.limit'
                :total='list.total'
                @page='paging.page = $event'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import type { ETLConnectionVideoLeaseList } from '../../../types.ts';
import TableFooter from '../../util/TableFooter.vue';
import {
    TablerInput,
    TablerEpoch,
    TablerAlert,
    TablerDelete,
    TablerLoading,
    TablerRefreshButton,
    TablerNone,
} from '@tak-ps/vue-tabler';

const route = useRoute();

const loading = ref(true);
const error = ref<Error | undefined>();
const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref<ETLConnectionVideoLeaseList>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetch();
});

onMounted(async () => {
    await fetch();
});

async function deleteAll() {
    loading.value = true;
    error.value = undefined;

    try {
        const url = stdurl(`/api/connection/${route.params.connectionid}/video/lease`);
        await std(url, {
            method: 'DELETE',
        });

        await fetch();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function fetch() {
    loading.value = true;
    error.value = undefined;

    try {
        const url = stdurl(`/api/connection/${route.params.connectionid}/video/lease`);
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('page', String(paging.value.page));
        url.searchParams.append('filter', paging.value.filter);
        list.value = await std(url) as ETLConnectionVideoLeaseList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div>
        <div class='card-header d-flex'>
            Data Syncs

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"Create Sync"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='router.push(`/connection/${props.connection.id}/data/new`)'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='listData'
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

            <TablerAlert
                v-if='err'
                title='ETL Server Error'
                :err='error'
                :compact='true'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                label='Data Syncs'
            />
            <div
                v-else
                class='table-resposive'
            >
                <table class='table card-table table-vcenter datatable table-hover'>
                    <thead>
                        <tr>
                            <th>Name</th>
                        </tr>
                    </thead>
                    <tbody class='table-tbody'>
                        <tr
                            v-for='data of list.items'
                            :key='data.id'
                            class='cursor-pointer'
                            @click='router.push(`/connection/${props.connection.id}/data/${data.id}`)'
                        >
                            <td>
                                <div class='d-flex align-items-center'>
                                    <IconDatabase
                                        :size='32'
                                        stroke='1'
                                        class='me-2'
                                    />
                                    <div
                                        class='user-select-none'
                                        v-text='data.name'
                                    />
                                    <div class='ms-auto'>
                                        <IconAccessPoint
                                            v-if='data.mission_sync'
                                            v-tooltip='"Mission Sync On"'
                                            :size='32'
                                            stroke='1'
                                            class='cursor-pointer text-green'
                                        />
                                        <IconAccessPointOff
                                            v-else
                                            v-tooltip='"Mission Sync Off"'
                                            :size='32'
                                            stroke='1'
                                            class='cursor-pointer text-red'
                                        />
                                    </div>
                                </div>
                            </td>
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

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import TableFooter from '../../util/TableFooter.vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    IconAccessPoint,
    IconAccessPointOff,
    IconDatabase,
    IconRefresh,
    IconPlus
} from '@tabler/icons-vue';

const route = useRoute();
const router = useRouter();

const props = defineProps({
    connection: {
        type: Object,
        required: true
    }
});

const loading = ref(true);
const error = ref();
const paging = ref({
    filter: '',
    limit: 10,
    page: 0
})
const list = ref({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await listData();
});

onMounted(async () => {
    await listData();
});

async function listData() {
    loading.value = true;
    try {
        const url = stdurl(`/api/connection/${route.params.connectionid}/data`);
        url.searchParams.append('limit', paging.value.limit);
        url.searchParams.append('page', paging.value.page);
        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('connection', route.params.connectionid);
        list.value = await std(url);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>

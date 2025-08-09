<template>
    <div>
        <div class='card-header d-flex'>
            <h2 class='card-title'>
                Layers
            </h2>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Create Layer'
                    @click='router.push(`/connection/${route.params.connectionid}/layer/new`)'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerRefreshButton
                    :loading='loading'
                    @click='listLayers'
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
                :err='err'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                label='Layers'
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
                            v-for='layer of list.items'
                            :key='layer.id'
                            class='cursor-pointer'
                            @click='router.push(`/connection/${route.params.connectionid}/layer/${layer.id}`)'
                        >
                            <td>
                                <div class='d-flex align-items-center'>
                                    <LayerStatus :layer='layer' /><div
                                        class='mx-2'
                                        v-text='layer.name'
                                    />

                                    <div class='ms-auto btn-list'>
                                        <IconDatabase
                                            v-if='layer.incoming && layer.incoming.data'
                                            v-tooltip='`Pushing to Data Sync`'
                                            :size='32'
                                            stroke='1'
                                            @click.stop.prevent='router.push(`/connection/${route.params.connectionid}/data/${layer.incoming.data}`)'
                                        />

                                        <IconExchange
                                            v-if='layer.incoming && layer.outgoing'
                                            title='Outgoing/Incoming'
                                            size='32'
                                            :stroke='1'
                                        />
                                        <IconStackPop
                                            v-else-if='layer.outgoing'
                                            title='Outgoing'
                                            size='32'
                                            :stroke='1'
                                        />
                                        <IconStackPush
                                            v-else-if='layer.incoming'
                                            title='Incoming'
                                            size='32'
                                            :stroke='1'
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
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import { std, stdurl } from '../../../std.ts';
import TableFooter from '../../util/TableFooter.vue';
import {
    IconPlus,
    IconExchange,
    IconStackPop,
    IconStackPush,
    IconDatabase
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler'
import LayerStatus from '../Layer/utils/StatusDot.vue';

const route = useRoute();
const router = useRouter();

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
    await listLayers();
});

onMounted(async () => {
    await listLayers();
});

async function listLayers() {
    loading.value = true;
    try {
        const url = stdurl(`/api/connection/${route.params.connectionid}/layer`);
        url.searchParams.append('alarms', String(true));
        url.searchParams.append('limit', paging.value.limit);
        url.searchParams.append('page', paging.value.page);
        url.searchParams.append('filter', paging.value.filter);
        list.value = await std(url);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false
}
</script>

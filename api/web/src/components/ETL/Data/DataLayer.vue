<template>
    <div>
        <div class='card-header d-flex'>
            <h2 class='card-title'>
                Layers
            </h2>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Create Layer'
                    @click='router.push(
                        `/connection/${route.params.connectionid}/data/${route.params.dataid}/layer/new`
                    )'
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

        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerAlert
                v-if='err'
                title='ETL Server Error'
                :err='err'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                label='No Layers'
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
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div
            class='position-absolute bottom-0 w-100'
            style='height: 61px;'
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
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import type { ETLConnection, ETLLayerList } from '../../../types.ts';
import TableFooter from '../../util/TableFooter.vue';
import {
    IconPlus,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerNone,
    TablerIconButton,
    TablerRefreshButton,
    TablerLoading
} from '@tak-ps/vue-tabler'
import LayerStatus from '../Layer/utils/StatusDot.vue';

defineProps<{
    connection: ETLConnection;
}>();

const route = useRoute();
const router = useRouter();

const loading = ref<boolean>(true);
const err = ref<Error>();
const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref<ETLLayerList>({
    total: 0,
    items: []
} as unknown as ETLLayerList);

onMounted(async () => {
    await listLayers();
});

watch(paging.value, async () => {
   await listLayers();
});

async function listLayers() {
    loading.value = true;
    try {
        const url = stdurl('/api/layer');
        url.searchParams.set('data', String(route.params.dataid));
        url.searchParams.set('limit', String(paging.value.limit));
        url.searchParams.set('page', String(paging.value.page));
        url.searchParams.set('filter', paging.value.filter);
        list.value = await std(url) as typeof list.value;
    } catch (e) {
        err.value = e instanceof Error ? e : new Error(String(e));
    }
    loading.value = false
}
</script>

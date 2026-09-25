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
                v-if='error'
                title='ETL Server Error'
                :err='error'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                label='No Layers'
            />
            <div
                v-else
                class='row row-cards px-2'
            >
                <div
                    v-for='layer of list.items'
                    :key='layer.id'
                    class='col-12 col-md-6'
                >
                    <StandardItemLayer
                        :layer='layer'
                        @click='router.push(`/connection/${route.params.connectionid}/layer/${layer.id}`)'
                    >
                        <template #actions>
                            <TablerIconButton
                                v-if='layer.incoming && layer.incoming.data'
                                title='Pushing to Data Sync'
                                class='flex-shrink-0'
                                @click.stop.prevent='router.push(`/connection/${route.params.connectionid}/data/${layer.incoming.data}`)'
                            >
                                <IconDatabase
                                    :size='24'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </template>
                    </StandardItemLayer>
                </div>
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
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import { server } from '../../../std.ts';
import type { ETLLayerList } from '../../../types.ts';
import TableFooter from '../../util/TableFooter.vue';
import {
    IconPlus,
    IconDatabase,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler'
import StandardItemLayer from '../../CloudTAK/util/StandardItemLayer.vue';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref<Error>();

const paging = ref({
    filter: '',
    limit: 12,
    page: 0
})

const list = ref<ETLLayerList>({
    total: 0,
    tasks: [],
    status: { healthy: 0, alarm: 0, unknown: 0 },
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
    error.value = undefined;
    try {
        const { data, error: serverError } = await server.GET('/api/connection/{:connectionid}/layer', {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid)
                },
                query: {
                    alarms: true,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    order: 'asc',
                    sort: 'created',
                    filter: paging.value.filter,
                }
            }
        });

        if (serverError) throw new Error(serverError.message);

        list.value = data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false
}
</script>

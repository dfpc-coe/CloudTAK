<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Server Overlay Admin
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Create Overlay'
                    @click='router.push("/admin/overlay/new")'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <div>
            <div class='row col-12 mx-1 my-2'>
                <div class='col'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter...'
                    />
                </div>
                <div class='col-auto d-flex align-items-center'>
                    <TablerPillGroup
                        v-model='paging.type'
                        :options='[
                            { value: "basemap", label: "Basemap" },
                            { value: "overlay", label: "Overlay" }
                        ]'
                        :full-width='false'
                        padding=''
                    />

                    <TablerIconButton
                        :title='advanced ? "Hide Advanced Search" : "Show Advanced Search"'
                        class='ms-2'
                        @click='advanced = !advanced'
                    >
                        <IconFilter
                            :size='32'
                            stroke='1'
                            :color='advanced ? "#206bc4" : "white"'
                        />
                    </TablerIconButton>
                </div>
            </div>

            <div
                v-if='advanced'
                class='row col-12 mx-1 my-2'
            >
                <div class='col-md-6'>
                    <TablerEnum
                        v-model='paging.scope'
                        label='Ownership'
                        default='all'
                        :options='[
                            "all",
                            "server",
                            "user"
                        ]'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerEnum
                        v-model='paging.hidden'
                        label='Hidden'
                        default='all'
                        :options='[
                            "true",
                            "false",
                            "all"
                        ]'
                    />
                </div>
            </div>

            <div
                v-if='paging.collection'
                class='d-flex align-items-center gap-2 mx-3 mt-2'
            >
                <BasemapCollection v-model:collection='paging.collection' />
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Overlays'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length && !list.collections.length'
                label='No Overlays'
                :create='false'
            />
            <div
                v-else
                class='d-flex flex-column gap-2 p-3 pb-5'
            >
                <StandardItemFolder
                    v-for='collection in list.collections'
                    :key='collection.name'
                    :name='collection.name'
                    @click='setCollection(collection.name)'
                />

                <StandardItemBasemap
                    v-for='ov in list.items'
                    :key='ov.id'
                    :basemap='ov'
                    @click='stdclick(router, $event, `/admin/overlay/${ov.id}`)'
                />
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
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { server, stdclick } from '../../std.ts';
import type { BasemapList } from '../../types.ts';
import StandardItemBasemap from '../CloudTAK/util/StandardItemBasemap.vue';
import StandardItemFolder from '../CloudTAK/util/StandardItemFolder.vue';
import BasemapCollection from '../CloudTAK/util/BasemapCollection.vue';
import TableFooter from '../util/TableFooter.vue'
import {
    TablerNone,
    TablerInput,
    TablerEnum,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
    TablerLoading,
    TablerPillGroup
} from '@tak-ps/vue-tabler';
import {
    IconFilter,
    IconPlus,
} from '@tabler/icons-vue'

const router = useRouter();

const advanced = ref(false);
const error = ref<Error | undefined>();
const loading = ref(true);

const paging = ref({
    filter: '',
    collection: '',
    sort: 'name',
    order: 'asc',
    limit: 100,
    scope: 'server',
    type: 'basemap',
    hidden: 'all',
    page: 0
});

const list = ref<BasemapList>({
    total: 0,
    collections: [],
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

function setCollection(collection: string) {
    paging.value.collection = collection;
    paging.value.filter = '';
    paging.value.page = 0;
}

async function fetchList() {
    error.value = undefined;
    loading.value = true;

    // Build standard query object manually to pacify typescript
    const query: Record<string, unknown> = {
        filter: paging.value.filter,
        collection: paging.value.collection || null,
        limit: paging.value.limit,
        page: paging.value.page,
        sort: paging.value.sort,
        order: paging.value.order,
        hidden: paging.value.hidden,
        overlay: false
    };

    if (paging.value.type === 'overlay') query.overlay = true;
    if (paging.value.scope !== "all") query.scope = paging.value.scope;

    const res = await server.GET('/api/basemap', {
        // @ts-expect-error Paging Config 
        params: { query }
    });
    
    if (res.error) error.value = new Error(res.error.message);
    else if (!res.data) error.value = new Error('No data returned');
    else list.value = res.data;

    loading.value = false;
}
</script>

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
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='row col-12 mx-1 my-2'>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        label='Name Filter'
                        placeholder='Filter...'
                    />
                </div>
                <div class='col-md-3'>
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
                <div class='col-md-3'>
                    <TablerEnum
                        v-model='paging.type'
                        label='Type'
                        default='basemap'
                        :options='[
                            "basemap",
                            "overlay"
                        ]'
                    />
                </div>
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
                v-else-if='!list.items.length'
                label='No Overlays'
                :create='false'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <TableHeader
                        v-model:sort='paging.sort'
                        v-model:order='paging.order'
                        v-model:header='header'
                    />
                    <tbody>
                        <tr
                            v-for='ov in list.items'
                            :key='ov.id'
                            tabindex='0'
                            class='cursor-pointer'
                            @keyup.enter='stdclick(router, $event, `/admin/overlay/${ov.id}`)'
                            @click='stdclick(router, $event, `/admin/overlay/${ov.id}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <span v-text='ov[h.name]' />

                                            <template v-if='h.name === "name"'>
                                                <div class='ms-auto'>
                                                    <span
                                                        v-if='!ov.username'
                                                        class='mx-3 ms-auto badge border bg-blue text-white'
                                                    >Public</span>
                                                    <span
                                                        v-else
                                                        class='mx-3 ms-auto badge border bg-red text-white'
                                                    >Private</span>

                                                    <span
                                                        v-if='!ov.overlay'
                                                        class='mx-3 ms-auto badge border bg-purple text-white'
                                                    >Basemap</span>
                                                    <span
                                                        v-else
                                                        class='mx-3 ms-auto badge border bg-green text-white'
                                                    >Overlay</span>
                                                </div>
                                            </template>
                                        </div>
                                    </td>
                                </template>
                            </template>
                        </tr>
                    </tbody>
                </table>
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
import { std, stdurl, stdclick } from '../../../src/std.ts';
import type { Basemap, BasemapList } from '../../../src/types.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import {
    TablerNone,
    TablerInput,
    TablerEnum,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
} from '@tabler/icons-vue'

type Header = { name: keyof Basemap, display: boolean };

const router = useRouter();

const error = ref<Error | undefined>();
const loading = ref(true);
const header = ref<Array<Header>>([]);

const paging = ref({
    filter: '',
    sort: 'name',
    order: 'asc',
    limit: 100,
    scope: 'server',
    type: 'basemap',
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
    await listBasemapSchema();
    await fetchList();
});

async function listBasemapSchema() {
    const schema = await std('/api/schema?method=GET&url=/basemap');

    const defaults: Array<keyof Basemap> = ['id', 'name'];
    header.value = defaults.map((h) => {
        return { name: h, display: true };
    });

    // @ts-expect-error Worth trying to type at some point maybe but not now
    header.value.push(...schema.query.properties.sort.enum.map((h) => {
        return {
            name: h,
            display: false
        } as Header
    }).filter((h: Header) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

async function fetchList() {
    loading.value = true;
    const url = stdurl('/api/basemap');

    if (paging.value.type === 'overlay') {
        url.searchParams.append('overlay', String(true));
    }

    if (paging.value.scope !== "all") {
        url.searchParams.append('scope', paging.value.scope);
    }
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', String(paging.value.limit));
    url.searchParams.append('page', String(paging.value.page));
    list.value = await std(url) as BasemapList;
    loading.value = false;
}
</script>

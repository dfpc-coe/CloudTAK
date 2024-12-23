<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Server Overlay Admin
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Create Overlay'
                    @click='$router.push("/admin/overlay/new")'
                ><IconPlus :size='32' stroke='1' /></TablerIconButton>
                <TablerIconButton
                    title='Refresh'
                    @click='fetchList'
                ><IconRefresh :size='32' stroke='1' /></TablerIconButton>
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerInput
                v-model='paging.filter'
                placeholder='Filter...'
                class='mx-1 my-2'
            />

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
                label='Overlays'
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
                            class='cursor-pointer'
                            @click='stdclick($router, $event, `/admin/overlay/${ov.id}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <span v-text='ov[h.name]' />
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
import { std, stdurl, stdclick } from '../../../src/std.ts';
import type { Basemap, BasemapList } from '../../../src/types.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerIconButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue'

type Header = { name: keyof Basemap, display: boolean };

const error = ref<Error | undefined>();
const loading = ref(true);
const header = ref<Array<Header>>([]);

const paging = ref({
    filter: '',
    sort: 'name',
    order: 'asc',
    limit: 100,
    page: 0
});

const list = ref<BasemapList>({
    total: 0,
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
    url.searchParams.append('overlay', 'true');
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', String(paging.value.limit));
    url.searchParams.append('page', String(paging.value.page));
    list.value = await std(url) as BasemapList;
    loading.value = false;
}
</script>

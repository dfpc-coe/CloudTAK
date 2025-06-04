<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Layer Templates
            </h1>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"Create Template"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='$router.push("/admin/template/new")'
                />
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerLoading
                v-if='loading'
                desc='Loading Layer Templates'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Layer Templates'
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
                            v-for='layer in list.items'
                            :key='layer.id'
                            class='cursor-pointer'
                            @click='stdclick($router, $event, `/admin/template/${layer.id}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <span v-text='layer[h.name]' />
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

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl, stdclick } from '/src/std.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
} from '@tabler/icons-vue'

const error = ref(false);
const loading = ref(true);
const header = ref([]);
const paging = ref({
    filter: '',
    sort: 'name',
    order: 'asc',
    limit: 100,
    page: 0
});
const list = ref({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listLayerTemplateSchema();
    await fetchList();
});

async function listLayerTemplateSchema() {
    const schema = await std('/api/schema?method=GET&url=/template');
    header.value = ['id', 'name', 'username', 'updated'].map((h) => {
        return { name: h, display: true };
    });

    header.value.push(...schema.query.properties.sort.enum.map((h) => {
        return {
            name: h,
            display: false
        }
    }).filter((h) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

async function fetchList() {
    loading.value = true;
    const url = stdurl('/api/template');
    if (paging.value.filter) url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', paging.value.limit);
    url.searchParams.append('page', paging.value.page);
    list.value = await std(url);
    loading.value = false;
}
</script>

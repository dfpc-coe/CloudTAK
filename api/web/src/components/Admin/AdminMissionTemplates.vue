<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Mission Templates
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Create Template'
                    @click='router.push("/admin/template/new")'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Refresh'
                    @click='fetchList'
                >
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='row col-12 mx-1 my-2'>
                <div class='col-md-12'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        label='Name Filter'
                        placeholder='Filter...'
                    />
                </div>
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Templates'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Templates'
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
                            v-for='template in list.items'
                            :key='template.id'
                            tabindex='0'
                            class='cursor-pointer'
                            @keyup.enter='stdclick(router, $event, `/admin/template/${template.id}`)'
                            @click='stdclick(router, $event, `/admin/template/${template.id}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <span v-text='template[h.name]' />
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
import type { MissionTemplateList, MissionTemplate } from '../../../src/types.ts';
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

type Header = { name: keyof MissionTemplate, display: boolean };

const router = useRouter();

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

const list = ref<MissionTemplateList>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listMissionTemplateSchema();
    await fetchList();
});

async function listMissionTemplateSchema() {
    const schema = await std('/api/schema?method=GET&url=/template/mission');

    const defaults: Array<keyof MissionTemplate> = ['name'];
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
    error.value = undefined;

    try {
        const url = stdurl('/api/template/mission');

        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('page', String(paging.value.page));
        url.searchParams.append('sort', paging.value.sort);
        list.value = await std(url) as MissionTemplateList;
     } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
     } finally {
        loading.value = false;
     }
}
</script>

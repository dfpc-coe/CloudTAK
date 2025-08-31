<template>
    <MenuTemplate name='Data Imports'>
        <template #buttons>
            <TablerIconButton
                v-if='!loading && !upload'
                title='New Import'
                @click='upload = true'
            >
                <IconUpload
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div
                v-if='upload'
                class='py-2 px-4'
            >
                <Upload
                    :url='stdurl(`/api/import`)'
                    :headers='uploadHeaders()'
                    method='PUT'
                    @cancel='upload = false'
                    @done='uploadComplete($event)'
                />
            </div>

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
                title='Imports Error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Imports'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='imported in list.items'
                    :key='imported.id'
                    @click='router.push(`/menu/imports/${imported.id}`)'
                >
                    <div class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover'>
                        <div class='col-auto'>
                            <Status
                                :dark='true'
                                :status='imported.status'
                            />
                        </div>
                        <div
                            v-tooltip='`${imported.source} Import`'
                            class='col-auto mx-2'
                        >
                            <IconAmbulance
                                v-if='imported.source === "Mission"'
                                :size='32'
                                stroke='0.5'
                            />
                            <IconFile
                                v-else-if='imported.source === "Upload"'
                                :size='32'
                                stroke='0.5'
                            />
                            <IconPackages
                                v-else-if='imported.source === "Package"'
                                :size='32'
                                stroke='0.5'
                            />
                        </div>
                        <div
                            class='mx-2 col-auto row'
                            style='width: 280px;'
                        >
                            <div
                                class='text-truncate'
                                v-text='imported.name'
                            />
                            <div
                                class='subheader'
                                v-text='timeDiff(imported.created)'
                            />
                        </div>
                    </div>
                </div>
            </template>

            <div class='px-2 py-2 d-flex'>
                <div class='ms-auto'>
                    <TablerPager
                        v-if='list.total > paging.limit'
                        :page='paging.page'
                        :total='list.total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { ImportList } from '../../../../src/types.ts';
import { std, stdurl } from '../../../../src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconUpload,
    IconFile,
    IconAmbulance,
    IconPackages,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import Status from '../../util/StatusDot.vue';
import timeDiff from '../../../timediff.ts';
import Upload from '../../util/Upload.vue';

const router = useRouter();
const upload = ref(false)
const error = ref<Error | undefined>();
const loading = ref(true);

const paging = ref({
    filter: '',
    limit: 20,
    page: 0
});

const list = ref<ImportList>({
    total: 0,
    items: []
});

watch(paging.value, async function() {
    await fetchList()
});

onMounted(async () => {
    await fetchList();
});

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

function uploadComplete(event: string) {
    upload.value = false;
    const imp = JSON.parse(event) as { imports: Array<{ uid: string }> };
    router.push(`/menu/imports/${imp.imports[0].uid}`)
}

async function fetchList() {
    loading.value = true;

    try {
        const url = stdurl('/api/import');
        url.searchParams.append('order', 'desc');
        url.searchParams.append('page', String(paging.value.page));
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('sort', 'created');
        list.value = await std(url) as ImportList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err))
    }

    loading.value = false;
}
</script>

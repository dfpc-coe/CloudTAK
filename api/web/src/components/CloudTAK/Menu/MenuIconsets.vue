<template>
    <MenuTemplate name='Iconsets'>
        <template #buttons>
            <TablerIconButton
                title='Create Iconset'
                @click='editModal = {}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='!upload'
                title='Zip Upload'
                @click='upload = true'
            >
                <IconFileUpload
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
            <template v-if='upload'>
                <div class='mx-4 my-4'>
                    <Upload
                        method='PUT'
                        :url='stdurl(`/api/import`)'
                        :headers='uploadHeaders()'
                        @done='processUpload($event)'
                        @cancel='upload = false'
                        @err='throws($event)'
                    />
                </div>
            </template>
            <template v-else>
                <div
                    class='px-2 py-2 round btn-group w-100'
                    role='group'
                >
                    <input
                        id='iconsets'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='mode === "iconsets"'
                        @click='mode = "iconsets"'
                    >
                    <label
                        for='iconsets'
                        type='button'
                        class='btn btn-sm'
                    ><IconAlbum
                        v-tooltip='"Iconsets"'
                        :size='32'
                        stroke='1'
                    /></label>

                    <input
                        id='icons'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='mode === "icons"'
                        @click='mode = "icons"'
                    >
                    <label
                        for='icons'
                        type='button'
                        class='btn btn-sm'
                    ><IconPhoto
                        v-tooltip='"Icons"'
                        :size='32'
                        stroke='1'
                    /></label>
                </div>

                <template v-if='mode === "iconsets"'>
                    <div class='px-3 pt-3'>
                        <TablerInput
                            v-model='paging.filter'
                            icon='search'
                            placeholder='Filter'
                        />
                    </div>

                    <TablerLoading
                        v-if='loading'
                        desc='Loading Iconsets'
                    />
                    <TablerAlert
                        v-else-if='error'
                        :err='error'
                    />
                    <TablerNone
                        v-else-if='!list.items.length'
                        label='Iconsets'
                        :create='false'
                    />
                    <div class='col-12 d-flex flex-column gap-2 p-3'>
                        <StandardItem
                            v-for='iconset in list.items'
                            :key='iconset.uid'
                            @click='router.push(`/menu/iconset/${iconset.uid}`)'
                        >
                            <div class='d-flex align-items-center px-2 py-2'>
                                <IconAlbum
                                    :size='32'
                                    stroke='1'
                                />
                                <div
                                    class='ms-2 flex-grow-1 fw-bold text-truncate'
                                    style='min-width: 0'
                                >
                                    {{ iconset.name }}
                                </div>

                                <div class='d-flex align-items-center flex-shrink-0'>
                                    <span
                                        v-if='!iconset.username'
                                        class='mx-3 badge border bg-blue text-white'
                                    >Public</span>
                                    <span
                                        v-else
                                        class='mx-3 badge border bg-red text-white'
                                    >Private</span>
                                    <TablerIconButton
                                        title='Download TAK Zip'
                                        @click.stop='download(iconset)'
                                    >
                                        <IconDownload
                                            :size='32'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>
                        </StandardItem>
                    </div>
                    <div class='col-lg-12 d-flex'>
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
                <template v-else>
                    <div class='col-lg-12'>
                        <IconCombineds
                            v-if='list.items.length'
                            :labels='false'
                        />
                    </div>
                </template>
            </template>
        </template>
    </MenuTemplate>

    <IconsetEditModal
        v-if='editModal'
        @close='editModal = false'
    />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import { std, stdurl } from '../../../std.ts';
import Upload from '../../util/Upload.vue';
import IconCombineds from '../util/Icons.vue'
import IconsetEditModal from './Iconset/EditModal.vue';
import {
    TablerNone,
    TablerPager,
    TablerInput,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconDownload,
    IconFileUpload,
    IconAlbum,
    IconPhoto,
    IconPlus
} from '@tabler/icons-vue'

const router = useRouter();
const mode = ref('iconsets');

const error = ref();
const loading = ref(true)
const upload = ref(false);
const editModal = ref(false);

const paging = ref({
    limit: 20,
    filter: '',
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
    await fetchList();
});

function throws(err) {
    throw err;
}

function processUpload(body) {
    router.push(`/menu/imports/${body.imports[0].uid}`);
}

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

async function download(iconset) {
    await std(`/api/iconset/${iconset.uid}?format=zip&download=true&token=${localStorage.token}`, {
        download: true
    });
}

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const url = stdurl('/api/iconset');
        url.searchParams.append('page', paging.value.page);
        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('limit', paging.value.limit);
        list.value = await std(url);
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>

<template>
    <MenuTemplate name='Iconsets'>
        <template #buttons>
            <TablerIconButton
                title='Create Iconset'
                @click='editModal = true'
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
                <div class='my-4'>
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
                <TablerPillGroup
                    v-model='mode'
                    :options='[
                        { value: "iconsets", label: "Iconsets" },
                        { value: "icons", label: "Icons" }
                    ]'
                >
                    <template #option='{ option }'>
                        <IconAlbum
                            v-if='option.value === "iconsets"'
                            v-tooltip='"Iconsets"'
                            :size='32'
                            stroke='1'
                        />
                        <IconPhoto
                            v-else
                            v-tooltip='"Icons"'
                            :size='32'
                            stroke='1'
                        />
                    </template>
                </TablerPillGroup>

                <template v-if='mode === "iconsets"'>
                    <div class='pt-3'>
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
                        label='No Iconsets'
                        :create='false'
                    />
                    <div class='col-12 d-flex flex-column gap-2 py-3'>
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
                                    <TablerBadge
                                        v-if='!iconset.username'
                                        class='mx-3'
                                        background-color='rgba(59, 130, 246, 0.25)'
                                        border-color='rgba(59, 130, 246, 0.5)'
                                        text-color='#2563eb'
                                    >
                                        Public
                                    </TablerBadge>
                                    <TablerBadge
                                        v-else
                                        class='mx-3'
                                        background-color='rgba(239, 68, 68, 0.2)'
                                        border-color='rgba(239, 68, 68, 0.5)'
                                        text-color='#dc2626'
                                    >
                                        Private
                                    </TablerBadge>
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

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import { std, stdurl } from '../../../std.ts';
import Upload from '../../util/Upload.vue';
import IconCombineds from '../util/Icons.vue';
import IconsetEditModal from './Iconset/EditModal.vue';
import {
    TablerBadge,
    TablerNone,
    TablerPager,
    TablerInput,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
    TablerPillGroup
} from '@tak-ps/vue-tabler';
import {
    IconDownload,
    IconFileUpload,
    IconAlbum,
    IconPhoto,
    IconPlus
} from '@tabler/icons-vue';
import type { IconsetList, Iconset } from '../../../types.ts';

interface ImportUploadResponse {
    imports: {
        file: string;
        uid: string;
        ext: string;
    }[];
}

const router = useRouter();

const mode = ref<'iconsets' | 'icons'>('iconsets');
const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const upload = ref(false);
const editModal = ref(false);

const paging = ref({
    limit: 20,
    filter: '',
    page: 0
});

const list = ref<IconsetList>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

function throws(err: Error): void {
    throw err;
}

function isImportUploadResponse(val: unknown): val is ImportUploadResponse {
    return (
        typeof val === 'object' &&
        val !== null &&
        'imports' in val &&
        Array.isArray((val as { imports: unknown }).imports)
    );
}

function processUpload(body: unknown): void {
    if (isImportUploadResponse(body) && body.imports.length > 0) {
        router.push(`/menu/imports/${body.imports[0].uid}`);
    }
}

function uploadHeaders(): Record<string, string> {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

async function download(iconset: Iconset): Promise<void> {
    await std(`/api/iconset/${iconset.uid}?format=zip&download=true&token=${localStorage.token}`, {
        download: true
    });
}

async function fetchList(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        const url = stdurl('/api/iconset');
        url.searchParams.set('page', String(paging.value.page));
        url.searchParams.set('filter', paging.value.filter);
        url.searchParams.set('limit', String(paging.value.limit));
        list.value = await std(url) as IconsetList;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>

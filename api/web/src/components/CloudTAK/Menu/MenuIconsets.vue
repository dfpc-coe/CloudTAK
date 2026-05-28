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
                @click='refreshList'
            />
        </template>
        <template #default>
            <template v-if='upload'>
                <div class='my-4'>
                    <Upload
                        method='PUT'
                        :url='stdurl(`/api/import`)'
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
                        v-else-if='loadError'
                        :err='loadError'
                    />
                    <template v-else>
                        <TablerAlert
                            v-if='syncError'
                            class='mt-3'
                            :err='syncError'
                        />
                        <TablerNone
                            v-if='!list.items.length'
                            label='No Iconsets'
                            :create='false'
                        />
                        <template v-else>
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
                                                @click.stop='IconsetCache.download(iconset.uid)'
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
                    </template>
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
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import IconsetCache from '../../../base/iconset.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import { stdurl } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
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
import type { DBIconset } from '../../../database.ts';
import type { Subscription } from 'dexie';

interface ImportUploadResponse {
    imports: {
        file: string;
        uid: string;
        ext: string;
    }[];
}

const router = useRouter();
const mapStore = useMapStore();

const mode = ref<'iconsets' | 'icons'>('iconsets');
const loadError = ref<Error | undefined>(undefined);
const syncError = ref<Error | undefined>(undefined);
const loading = ref(true);
const upload = ref(false);
const editModal = ref(false);

const paging = ref({
    limit: 20,
    filter: '',
    page: 0
});

const list = ref<{ total: number; items: DBIconset[] }>({
    total: 0,
    items: []
});
let listSubscription: Subscription | undefined;

watch(
    () => [paging.value.filter, paging.value.limit, paging.value.page] as const,
    ([filter], [previousFilter]) => {
        if (filter !== previousFilter && paging.value.page !== 0) {
            paging.value.page = 0;
            return;
        }

        subscribeList();
    }
);

onMounted(() => {
    subscribeList();
});

onUnmounted(() => {
    listSubscription?.unsubscribe();
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

function subscribeList(): void {
    listSubscription?.unsubscribe();
    loading.value = true;
    loadError.value = undefined;

    listSubscription = IconsetCache.liveList({
        paged: true,
        filter: paging.value.filter,
        limit: paging.value.limit,
        page: paging.value.page
    }).subscribe({
        next: (page) => {
            list.value = page;
            loading.value = false;
        },
        error: (err: unknown) => {
            loadError.value = err instanceof Error ? err : new Error(String(err));
            list.value = {
                total: 0,
                items: []
            };
            loading.value = false;
        }
    });
}

async function refreshList(): Promise<void> {
    loading.value = true;
    syncError.value = undefined;

    try {
        await mapStore.icons.hydrate({ force: true });
    } catch (err) {
        syncError.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>

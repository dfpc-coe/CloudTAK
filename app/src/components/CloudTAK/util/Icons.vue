<template>
    <div>
        <div class='card-body'>
            <div class='col-12 px-2 pt-2'>
                <TablerInput
                    v-model='paging.filter'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Icons'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Icons'
                :create='false'
            />
            <template v-else>
                <div class='row g-1 pt-2'>
                    <div
                        v-for='icon in list.items'
                        :key='icon.key'
                        class='col-sm-2'
                        @click='openIcon(icon)'
                    >
                        <div class='card card-sm cloudtak-hover cursor-pointer'>
                            <div class='col-12'>
                                <div
                                    class='d-flex justify-content-center mt-3'
                                    :class='{
                                        "mt-3": labels,
                                        "my-3": !labels
                                    }'
                                >
                                    <img
                                        :src='icon.data'
                                        class='img-thumbnail'
                                        style='background-color: rgb(30, 41, 59);'
                                        height='32'
                                        width='32'
                                    >
                                </div>
                            </div>
                            <div
                                v-if='labels'
                                class='card-body'
                            >
                                <div class='row'>
                                    <div
                                        class='d-inline-block text-truncate'
                                        v-text='icon.path'
                                    />
                                    <div
                                        class='d-inline-block text-truncate text-muted'
                                        v-text='icon.type2525b || "None"'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='col-lg-12 d-flex my-4'>
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
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import IconCache from '../../../base/icon.ts';
import {
    TablerNone,
    TablerPager,
    TablerInput,
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler';

interface DisplayIcon {
    key: string;
    iconset: string;
    path: string;
    type2525b: string | null;
    data: string;
}

const props = defineProps({
    iconset: {
        type: String,
        default: undefined
    },
    labels: {
        type: Boolean,
        default: true
    },
    refreshKey: {
        type: Number,
        default: 0
    }
});

const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const urls = ref<string[]>([]);

const paging = ref({
    filter: '',
    limit: 100 - 4, // keeps the icon in an even grid
    page: 0
});

const list = ref<{ total: number; items: DisplayIcon[] }>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

watch(() => props.iconset, async () => {
    paging.value.page = 0;
    await fetchList();
});

watch(() => props.refreshKey, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

onUnmounted(() => {
    revokeUrls();
});

function revokeUrls(): void {
    for (const url of urls.value) {
        URL.revokeObjectURL(url);
    }

    urls.value = [];
}

function openIcon(icon: DisplayIcon): void {
    router.push(`/menu/iconset/${icon.iconset}/${encodeURIComponent(icon.path)}`);
}

async function fetchList() {
    loading.value = true;
    error.value = undefined;
    revokeUrls();

    try {
        const all = props.iconset
            ? await IconCache.list(props.iconset)
            : await IconCache.all();

        const filter = paging.value.filter.trim().toLowerCase();
        const filtered = filter
            ? all.filter((icon) => {
                return icon.path.toLowerCase().includes(filter)
                    || icon.iconset.toLowerCase().includes(filter)
                    || (icon.type2525b || '').toLowerCase().includes(filter);
            })
            : all;

        const offset = paging.value.page * paging.value.limit;
        const page = filtered.slice(offset, offset + paging.value.limit);

        list.value = {
            total: filtered.length,
            items: page.map((icon) => {
                const url = URL.createObjectURL(icon.data);
                urls.value.push(url);

                return {
                    key: icon.name,
                    iconset: icon.iconset,
                    path: icon.path,
                    type2525b: icon.type2525b,
                    data: url
                };
            })
        };
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        list.value = {
            total: 0,
            items: []
        };
    } finally {
        loading.value = false;
    }
}
</script>

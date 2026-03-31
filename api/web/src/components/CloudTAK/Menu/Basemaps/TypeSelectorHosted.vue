<template>
    <div class='row row-cards'>
        <TypeSelectorSelected
            type='hosted'
            @change-type='emit("change-type")'
        />

        <div class='col-12'>
            <TablerLoading v-if='loading.config' />
            <template v-else>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter tilesets'
                    class='mb-3'
                />

                <TablerLoading
                    v-if='loading.list'
                    :inline='true'
                    desc='Loading Tilesets'
                />
                <TablerNone
                    v-else-if='!list.items.length'
                    :create='false'
                    label='No Hosted Tilesets'
                />
                <template v-else>
                    <div class='d-flex flex-column gap-2'>
                        <StandardItem
                            v-for='tile in list.items'
                            :key='tile.name'
                            class='d-flex align-items-center gap-3 px-3 py-2'
                            :class='{ "bg-blue": selected === tile.name }'
                            @click='select(tile)'
                        >
                            <IconDatabase
                                :size='24'
                                stroke='1'
                            />
                            <span class='fw-semibold'>{{ displayName(tile.name) }}</span>
                        </StandardItem>
                    </div>

                    <div class='d-flex mt-2'>
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
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../../std.ts';
import StandardItem from '../../util/StandardItem.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import {
    TablerNone,
    TablerInput,
    TablerPager,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconDatabase,
} from '@tabler/icons-vue';

const emit = defineEmits<{
    'change-type': [];
    done: [value: unknown];
}>();

const loading = ref({
    config: true,
    list: true,
});

const selected = ref<string | null>(null);
const config = ref<{ url: string }>();

const paging = ref({
    filter: '',
    limit: 10,
    page: 0,
});

const list = ref<{ total: number; items: Array<{ name: string }> }>({
    total: 0,
    items: [],
});

watch(paging.value, async () => {
    await listTiles();
});

onMounted(async () => {
    config.value = await std('/api/config/tiles') as { url: string };
    loading.value.config = false;
    await listTiles();
});

function displayName(name: string): string {
    return name.replace(/^public\//, '').replace(/\.pmtiles$/, '');
}

async function select(tile: { name: string }) {
    selected.value = tile.name;

    const name = tile.name.replace(/^public\//, '').replace(/\.pmtiles$/, '');
    const url = stdurl(new URL(config.value!.url + `/tiles/public/${name}`));
    url.searchParams.set('token', localStorage.token);

    const detail = await std(url) as Record<string, unknown>;
    detail.url = url.toString();

    emit('done', detail);
}

async function listTiles() {
    loading.value.list = true;
    const url = stdurl(new URL(config.value!.url + '/tiles/public'));
    url.searchParams.set('token', localStorage.token);
    url.searchParams.set('filter', paging.value.filter);
    url.searchParams.set('limit', String(paging.value.limit));
    url.searchParams.set('page', String(paging.value.page));
    list.value = await std(url) as { total: number; items: Array<{ name: string }> };
    loading.value.list = false;
}
</script>

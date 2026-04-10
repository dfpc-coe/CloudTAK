<template>
    <div>
        <div class='d-flex align-items-center user-select-none'>
            <label class='mx-1 mb-1'>Public Tiles Selection</label>
        </div>
        <div class='card'>
            <div class='card-body'>
                <TablerLoading
                    v-if='loading.main'
                    :inline='true'
                    desc='Loading Tiles'
                />
                <TablerLoading
                    v-else-if='loading.tiles'
                    :inline='true'
                    desc='Loading Tile Metadata'
                />
                <template v-else-if='selected'>
                    <div class='col-12 d-flex align-items-center user-select-none'>
                        <div v-text='selected.name' />
                        <div class='ms-auto btn-list'>
                            <IconX
                                v-tooltip='"Remove Tile"'
                                :size='32'
                                stroke='1'
                                class='cursor-pointer'
                                @click='selected = undefined'
                            />
                        </div>
                    </div>
                </template>
                <template v-else>
                    <TablerInput
                        v-model='paging.filter'
                        placeholder='Task Filter...'
                        class='pb-2'
                    />

                    <div
                        v-if='loading.list'
                        class='card-body'
                    >
                        <TablerLoading desc='Loading Tasks' />
                    </div>
                    <TablerNone
                        v-else-if='list.total === 0'
                        :create='false'
                        :compact='true'
                        label='No Tasks'
                    />
                    <template
                        v-for='task in list.items'
                        v-else
                    >
                        <div
                            class='cloudtak-hover px-2 py-2 cursor-pointer rounded user-select-none d-flex align-items-center'
                            @click='select(task)'
                        >
                            <div v-text='task.name.replace(/^public\//, "").replace(/\.pmtiles$/, "")' />
                        </div>
                    </template>
                </template>
            </div>
            <div
                v-if='!loading.main && !loading.task && list.total > paging.limit && !selected?.id'
                class='card-footer d-flex'
            >
                <div class='ms-auto'>
                    <TablerPager
                        :page='paging.page'
                        :total='list.total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../std.ts';
import type { APIList } from '../../types.ts';
import {
    IconX,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerPager,
    TablerNone,
} from '@tak-ps/vue-tabler';

interface TileDetail {
    name: string;
    url?: string;
    [key: string]: unknown;
}

const emit = defineEmits<{
    (e: 'select', tile: TileDetail | undefined): void;
}>();

const props = withDefaults(defineProps<{
    url?: string;
}>(), {
    url: undefined,
});

const loading = ref<Record<string, boolean>>({
    main: true,
    modal: true,
    list: true,
});

const config = ref<{ url: string }>();

const selected = ref<TileDetail>();

const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref<APIList<TileDetail>>({
    total: 0,
    items: []
});

watch(selected, () => {
    if (selected.value) {
        emit('select', selected.value);
    } else {
        emit('select', undefined);
    }
}, {
    deep: true
});

watch(paging.value, async () => {
    await listTiles();
});

watch(() => props.url, async () => {
    await fetchSelected();
});

onMounted(async () => {
    await listTiles();
    await fetchSelected();

    loading.value.main = false;
});

async function fetchSelected() {
    if (props.url && !selected.value) {
        try {
            // If the URL contains tiles.map.cotak.gov we can assume it is a public tile
            // and we can extract the name from the path
            const u = new URL(props.url);
            const match = u.pathname.match(/\/tiles\/public\/([a-zA-Z0-9._-]+)/);

            if (match && match[1]) {
                const name = match[1];
                if (!config.value) config.value = await std('/api/config/tiles') as { url: string };
                const url = stdurl(new URL(config.value.url + `/tiles/public/${name}`));
                url.searchParams.set('token', localStorage.token);
                selected.value = await std(url) as TileDetail;
                selected.value.url = url.toString();
            }
        } catch (err) {
            console.error('Failed to parse URL for Public Tile', err);
        }
    }
}

async function select(tile: TileDetail) {
    loading.value.tiles = true;

    if (!config.value) {
        config.value = await std('/api/config/tiles') as { url: string };
    }

    const name = tile.name.replace(/^public\//, "").replace(/\.pmtiles$/, '');

    const url = stdurl(new URL(config.value.url + `/tiles/public/${name}`));
    url.searchParams.set('token', localStorage.token);

    const detail = await std(url) as TileDetail;
    detail.url = url.toString();
    selected.value = detail;

    loading.value.tiles = false;
}

async function listTiles() {
    if (!config.value) {
        config.value = await std('/api/config/tiles') as { url: string };
    }

    loading.value.list = true;
    const url = stdurl(new URL(config.value.url + '/tiles/public'));
    url.searchParams.set('token', localStorage.token);
    url.searchParams.set('filter', paging.value.filter);
    url.searchParams.set('limit', String(paging.value.limit));
    url.searchParams.set('page', String(paging.value.page));
    list.value = await std(url) as APIList<TileDetail>;

    loading.value.list = false;
}
</script>

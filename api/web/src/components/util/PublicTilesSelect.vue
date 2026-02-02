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
                            <IconTrash
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
                        label='Tasks'
                    />
                    <template
                        v-for='task in list.items'
                        v-else
                    >
                        <div
                            class='hover px-2 py-2 cursor-pointer rounded user-select-none d-flex align-items-center'
                            @click='select(task)'
                        >
                            <div v-text='task.name.replace(/^public\//, "").replace(/\.pmtiles$/, "")' />
                        </div>
                    </template>
                </template>
            </div>
            <div
                v-if='!loading.main && !loading.task && list.total > paging.limit && !selected.id'
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

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '/src/std.ts';
import {
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerPager,
    TablerNone,
} from '@tak-ps/vue-tabler';

const emit = defineEmits([
    'select'
]);

const props = defineProps({
    url: {
        type: String
    }
});

const loading = ref({
    main: true,
    modal: true,
    list: true,
});

const config = ref();

const selected = ref();

const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref({
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

onMounted(async () => {
    await listTiles();

    if (props.url) {
        try {
            const u = new URL(props.url);
            const match = u.pathname.match(/\/public\/(.+?)\//);

            if (match && match[1]) {
                const name = match[1];
                const url = stdurl(new URL(config.value.url + `/tiles/public/${name}`));
                url.searchParams.append('token', localStorage.token);
                selected.value = await std(url);
            }
        } catch (err) {
            console.error('Failed to parse URL for Public Tile', err);
        }
    }

    loading.value.main = false;
});

async function select(tile) {
    loading.value.tiles = true;

    if (!config.value) {
        config.value = await std('/api/config/tiles');
    }

    const name = tile.name.replace(/^public\//, "").replace(/\.pmtiles$/, '');

    const url = stdurl(new URL(config.value.url + `/tiles/public/${name}`));
    url.searchParams.append('token', localStorage.token);

    const detail = await std(url);
    selected.value = detail;

    loading.value.tiles = false;
}

async function listTiles() {
    if (!config.value) {
        config.value = await std('/api/config/tiles');
    }

    loading.value.list = true;
    const url = stdurl(new URL(config.value.url + '/tiles/public'));
    url.searchParams.append('token', localStorage.token);
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', paging.value.limit);
    url.searchParams.append('page', paging.value.page);
    list.value = await std(url);

    loading.value.list = false;
}
</script>

<template>
    <div>
        <TablerLoading
            v-if='loading'
            :desc='loadingLabel'
        />
        <template v-else>
            <div class='d-flex align-items-center gap-2 mb-3'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    :placeholder='placeholder'
                    class='flex-grow-1'
                />
                <TablerPillGroup
                    v-if='overlays'
                    v-model='paging.overlay'
                    :options='[
                        { value: "basemap", label: "Basemap" },
                        { value: "overlay", label: "Overlay" }
                    ]'
                    :full-width='false'
                    padding=''
                />
            </div>

            <TablerNone
                v-if='!visible.length'
                :create='false'
                :label='emptyLabel'
            />
            <template v-else>
                <div class='d-flex flex-column gap-2'>
                    <StandardItem
                        v-for='basemap in visible'
                        :key='basemap.id'
                        class='d-flex align-items-center gap-3 px-3 py-2'
                        @click='emit("select", basemap)'
                    >
                        <slot name='icon'>
                            <IconMap
                                :size='24'
                                stroke='1'
                            />
                        </slot>
                        <div>
                            <div
                                class='fw-semibold'
                                v-text='basemap.name'
                            />
                            <div class='small text-white-50'>
                                {{ basemap.type }} · Zoom {{ basemap.minzoom }} - {{ basemap.maxzoom }}
                            </div>
                        </div>
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
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { server } from '../../../../std.ts';
import StandardItem from '../../util/StandardItem.vue';
import type { BasemapList } from '../../../../types.ts';
import {
    TablerInput,
    TablerLoading,
    TablerNone,
    TablerPager,
    TablerPillGroup,
} from '@tak-ps/vue-tabler';
import { IconMap } from '@tabler/icons-vue';

export type PickableBasemap = BasemapList['items'][0];

const props = withDefaults(defineProps<{
    types: Array<'raster' | 'raster-dem' | 'vector'>;
    /** Offer a Basemap / Overlay toggle instead of listing basemaps only */
    overlays?: boolean;
    /** Basemap ids to leave out of the list */
    exclude?: number[];
    placeholder?: string;
    emptyLabel?: string;
    loadingLabel?: string;
}>(), {
    overlays: false,
    exclude: () => [],
    placeholder: 'Filter basemaps',
    emptyLabel: 'No Basemaps',
    loadingLabel: 'Loading Basemaps',
});

const emit = defineEmits<{
    select: [value: PickableBasemap];
}>();

const loading = ref(true);

const paging = ref({
    filter: '',
    overlay: 'basemap',
    limit: 10,
    page: 0,
});

const list = ref<Pick<BasemapList, 'total' | 'items'>>({
    total: 0,
    items: [],
});

const visible = computed(() => list.value.items.filter((item) => !props.exclude.includes(item.id)));

watch(paging.value, fetchList);

onMounted(fetchList);

async function fetchList(): Promise<void> {
    loading.value = true;
    try {
        const res = await server.GET('/api/basemap', {
            params: {
                query: {
                    type: props.types,
                    overlay: paging.value.overlay === 'overlay',
                    hidden: 'all',
                    sort: 'name',
                    order: 'asc',
                    filter: paging.value.filter,
                    limit: paging.value.limit,
                    page: paging.value.page,
                },
            },
        });

        if (res.error) throw new Error(res.error.message);

        list.value = { total: res.data.total, items: res.data.items };
    } finally {
        loading.value = false;
    }
}
</script>

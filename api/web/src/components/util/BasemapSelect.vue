<template>
    <div>
        <div v-if='loading.init'>
            <TablerLoading
                :inline='true'
                desc='Loading Basemap'
            />
        </div>
        <div v-else-if='modelValue && !err'>
            <div class='card'>
                <div class='card-body d-flex align-items-center'>
                    <div>{{ selected?.name || 'Unknown Basemap' }}</div>
                    <div
                        v-if='!disabled'
                        class='ms-auto'
                    >
                        <IconTrash
                            v-if='!disabled'
                            v-tooltip='"Remove Basemap"'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='emit("update:modelValue", null)'
                        />
                    </div>
                </div>
            </div>
        </div>
        <div v-else-if='disabled'>
            <TablerNone
                :create='false'
                label='No Default Basemap'
            />
        </div>
        <div
            v-else
            class='card'
        >
            <div
                v-if='loading.list && list.items.length === 0'
                class='card-body'
            >
                <TablerLoading desc='Loading Basemaps' />
            </div>
            <div
                v-else
                class='card-body'
            >
                <div
                    v-if='err'
                    class='pb-2'
                >
                    <TablerInlineAlert
                        title='Failed to load provided basemap'
                        :description='String(err)'
                        severity='danger'
                    />
                </div>
                <TablerInput
                    v-model='paging.filter'
                    placeholder='Filter Basemaps...'
                    class='mb-2'
                />
                
                <TablerLoading
                    v-if='loading.list'
                    desc='Loading Basemaps'
                />
                <TablerNone
                    v-else-if='list.total === 0'
                    :create='false'
                    label='No Basemaps Found'
                />
                <template v-else>
                    <div
                        v-for='basemap in list.items'
                        :key='basemap.id'
                        class='d-flex align-items-center p-2 cloudtak-hover cursor-pointer rounded'
                        @click='emit("update:modelValue", basemap.id)'
                    >
                        {{ basemap.name }}
                    </div>
                </template>
            </div>
            <div
                v-if='list.total > paging.limit'
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

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { server } from '../../std.ts';
import {
    IconTrash
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
    TablerPager,
    TablerInlineAlert
} from '@tak-ps/vue-tabler';
import type { Basemap, BasemapList } from '../../types.ts';

const props = withDefaults(defineProps<{
    modelValue?: number | string | null;
    disabled?: boolean;
}>(), {
    modelValue: null,
    disabled: false
});

const emit = defineEmits<{
    'update:modelValue': [value: number | string | null];
}>();

const loading = ref<{
    init: boolean;
    list: boolean;
}>({
    init: false,
    list: false
});

const err = ref<Error | null>(null);
const selected = ref<Basemap | null>(null);

const paging = ref<{
    filter: string;
    limit: number;
    page: number;
}>({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref<BasemapList>({
    total: 0,
    collections: [],
    items: []
});

watch(() => props.modelValue, async () => {
    await fetchSelected();
    if (!props.modelValue && !props.disabled) {
        await fetchList();
    }
});

watch(paging, async () => {
    if (!props.modelValue && !props.disabled) {
        await fetchList();
    }
}, { deep: true });

watch(() => props.disabled, async () => {
    if (!props.modelValue && !props.disabled) {
        await fetchList();
    }
});

onMounted(async () => {
    await fetchSelected();
    if (!props.modelValue && !props.disabled) {
        await fetchList();
    }
});

async function fetchSelected(): Promise<void> {
    err.value = null;
    if (!props.modelValue) {
        selected.value = null;
        return;
    }

    loading.value.init = true;
    const { data, error } = await server.GET('/api/basemap/{:basemapid}', {
        params: { path: { ':basemapid': Number(props.modelValue) } }
    });
    if (error) {
        err.value = new Error(String(error));
        await fetchList();
    } else if (typeof data !== 'string') {
        selected.value = data;
    }
    loading.value.init = false;
}

async function fetchList(): Promise<void> {
    loading.value.list = true;
    const { data, error } = await server.GET('/api/basemap', {
        params: {
            query: {
                limit: paging.value.limit,
                page: paging.value.page,
                filter: paging.value.filter,
                overlay: false,
                order: 'asc',
                sort: 'name',
                hidden: 'false'
            }
        }
    });
    if (error) {
        console.error(error);
    } else {
        list.value = data;
    }
    loading.value.list = false;
}
</script>

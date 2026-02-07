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
                        class='d-flex align-items-center p-2 hover cursor-pointer rounded'
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

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../std.ts';
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

const props = defineProps({
    modelValue: {
        type: [Number, String],
        default: null
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

const loading = ref({
    init: false,
    list: false
});

const err = ref(null);
const selected = ref(null);

const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref({
    total: 0,
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

async function fetchSelected() {
    err.value = null;
    if (!props.modelValue) {
        selected.value = null;
        return;
    }

    loading.value.init = true;
    try {
        const url = stdurl(`/api/basemap/${props.modelValue}`);
        selected.value = await std(url);
    } catch (e) {
        err.value = e;
        await fetchList();
    }
    loading.value.init = false;
}

async function fetchList() {
    loading.value.list = true;
    try {
        const url = stdurl('/api/basemap');
        url.searchParams.set('limit', paging.value.limit);
        url.searchParams.set('page', paging.value.page);
        url.searchParams.set('filter', paging.value.filter);
        const res = await std(url);
        list.value = res;
    } catch (err) {
        console.error(err);
    }
    loading.value.list = false;
}
</script>

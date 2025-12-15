<template>
    <div>
        <div class='d-flex align-items-center'>
            <label class='mx-1 mb-1'>Layer Selection</label>
        </div>
        <div class='card'>
            <div class='card-body'>
                <TablerLoading
                    v-if='loading.main'
                    :inline='true'
                    desc='Loading Layers'
                />
                <template v-else-if='selected.id'>
                    <div class='col-12 d-flex align-items-center'>
                        <div v-text='selected.name' />
                        <div class='ms-auto'>
                            <IconTrash
                                v-if='selected.id && list.total > 1'
                                v-tooltip='"Remove Layer"'
                                :size='32'
                                stroke='1'
                                class='cursor-pointer'
                                @click='selected = {}'
                            />
                        </div>
                    </div>
                </template>
                <template v-else>
                    <div class='mb-2'>
                        <TablerInput
                            v-model='paging.filter'
                            placeholder='Layer Filter...'
                        />
                    </div>

                    <div
                        v-if='loading.list'
                        class='card-body'
                    >
                        <TablerLoading desc='Loading Layers' />
                    </div>
                    <TablerNone
                        v-else-if='list.total === 0'
                        :create='false'
                        :compact='true'
                        label='Layers'
                    />
                    <template
                        v-for='layer in list.items'
                        v-else
                    >
                        <div
                            class='hover px-2 py-2 cursor-pointer row rounded'
                            @click='selected = layer'
                        >
                            <div class='col-md-4'>
                                <span v-text='layer.name' />
                            </div>

                            <div
                                class='col-md-8'
                                v-text='layer.description'
                            />
                        </div>
                    </template>
                </template>
            </div>
            <div
                v-if='list.total > paging.limit && !selected.id'
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

const props = defineProps({
    modelValue: {
        type: Number,
        default: undefined
    },
});

const emit = defineEmits([
    'update:modelValue'
]);

const loading = ref({
    main: true,
    list: true,
})

const selected = ref({
    id: '',
    name: ''
})

const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref({
    total: 0,
    items: []
});

watch(selected, async () => {
    emit('update:modelValue', selected.value.id);
}, { deep: true });

watch(props.modelValue, async () => {
    await fetch();
});

watch(paging.value, async () => {
    await listData();
});

onMounted(async () => {
    if (props.modelValue) await fetch();
    await listData();
    loading.value.main = false;
});

async function fetch() {
    selected.value = await std(`/api/layer/${props.modelValue}`);
}

async function listData() {
    loading.value.list = true;
    const url = stdurl('/api/layer');
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', paging.value.limit);
    url.searchParams.append('page', paging.value.page);
    list.value = await std(url);

    loading.value.list = false;
}
</script>

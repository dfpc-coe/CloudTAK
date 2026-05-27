<template>
    <div>
        <div class='d-flex align-items-center'>
            <label class='mx-1 mb-1'>Template Selection</label>
        </div>
        <div class='card'>
            <div class='card-body'>
                <TablerLoading
                    v-if='loading.main'
                    :inline='true'
                    desc='Loading Templates'
                />
                <template v-else-if='selected.id'>
                    <div class='col-12 d-flex align-items-center'>
                        <div v-text='selected.name' />
                        <div class='ms-auto'>
                            <IconTrash
                                v-if='selected.id'
                                v-tooltip='"Remove Template"'
                                :size='32'
                                stroke='1'
                                class='cursor-pointer'
                                @click='selected = {}'
                            />
                        </div>
                    </div>
                </template>
                <template v-else>
                    <TablerInput
                        v-model='paging.filter'
                        placeholder='Template Filter...'
                        class='pb-2'
                    />

                    <div
                        v-if='loading.list'
                        class='card-body'
                    >
                        <TablerLoading desc='Loading Templates' />
                    </div>
                    <TablerNone
                        v-else-if='list.total === 0'
                        :create='false'
                        :compact='true'
                        label='No Templates'
                    />
                    <template
                        v-for='layer in list.items'
                        v-else
                    >
                        <div
                            class='cloudtak-hover px-2 py-2 cursor-pointer row rounded'
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

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { APIList } from '../../types.ts';
import {
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerPager,
    TablerNone,
} from '@tak-ps/vue-tabler';

interface Template {
    id?: string | number;
    name?: string;
    description?: string;
}

const props = withDefaults(defineProps<{
    modelValue?: Template;
    disabled?: boolean;
}>(), {
    modelValue: undefined,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: Template | Record<string, never>): void;
}>();

const loading = ref({
    main: true,
    list: true,
});

const selected = ref<Template>({
    id: '',
});

const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref<APIList<Template>>({
    total: 0,
    items: []
});

watch(selected, () => {
    if (selected.value.id) {
        emit('update:modelValue', selected.value);
    } else {
        emit('update:modelValue', {});
    }
}, { deep: true });

watch(() => props.modelValue, async () => {
    if (props.modelValue && props.modelValue.id !== selected.value.id) {
        await fetch();
    }
});

watch(paging, async () => {
    await listData();
}, { deep: true });

onMounted(async () => {
    if (props.modelValue) {
        await fetch();
    }

    await listData();
    loading.value.main = false;
});

async function fetch() {
    if (!props.modelValue?.id) return;
    selected.value = props.modelValue;
}

async function listData() {
    loading.value.list = true;
    const res = await server.GET('/api/template', {
        params: {
            query: {
                filter: paging.value.filter,
                limit: paging.value.limit,
                page: paging.value.page,
                order: 'asc',
                sort: 'name'
            }
        }
    });

    if (res.error) throw new Error(res.error.message);
    list.value = res.data as APIList<Template>;

    loading.value.list = false;
}
</script>

<template>
    <div>
        <div class='d-flex align-items-center user-select-none'>
            <label class='mx-1 mb-1'>Task Selection</label>
        </div>
        <div class='card'>
            <div class='card-body'>
                <TablerLoading
                    v-if='loading.main'
                    :inline='true'
                    desc='Loading Tasks'
                />
                <TablerLoading
                    v-else-if='loading.task'
                    :inline='true'
                    desc='Loading Task'
                />
                <template v-else-if='selected.id'>
                    <div class='col-12 d-flex align-items-center user-select-none'>
                        <div v-text='selected.name' />
                        <div class='ms-auto btn-list'>
                            <TablerEnum
                                v-model='selected.version'
                                :options='selected.versions'
                            />

                            <IconTrash
                                v-if='selected.id'
                                v-tooltip='"Remove Tasks"'
                                :size='32'
                                stroke='1'
                                class='cursor-pointer'
                                @click='selected.id = undefined'
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
                            class='hover-light px-2 py-2 cursor-pointer rounded user-select-none d-flex align-items-center'
                            @click='selected = select(task)'
                        >
                            <div v-text='task.name' />
                            <div class='ms-auto'>
                                <TablerIconButton
                                    title='Task Info'
                                    @click.prevent.stop='infoModal = task'
                                >
                                    <IconInfoSquare
                                        :size='32'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
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

    <TablerModal
        v-if='infoModal'
        size='xl'
    >
        <div class='modal-header'>
            <IconInfoSquare
                size='24'
                stroke='1'
            />
            <span
                class='mx-2'
                v-text='infoModal.name'
            />
            <button                                       
                type='button'                  
                class='btn-close'            
                aria-label='Close'                                 
                @click='infoModal = undefined'                                            
            />
        </div>
        <div
            class='modal-body overflow-auto'
            style='max-height: 50vh'
        >
            <TablerLoading
                v-if='!infoModal.readme_body'
            />
            <TablerMarkdown
                v-else
                :markdown='infoModal.readme_body'
            />
        </div>
        <div class='modal-footer'>
            <button
                class='btn btn-primary'
                @click='infoModal = undefined'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '/src/std.ts';
import {
    IconTrash,
    IconInfoSquare,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerMarkdown,
    TablerIconButton,
    TablerLoading,
    TablerEnum,
    TablerInput,
    TablerPager,
    TablerNone,
} from '@tak-ps/vue-tabler';

const props = defineProps({
    modelValue: Object,
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'update:modelValue'
]);

const loading = ref({
    main: true,
    modal: true,
    list: true,
});

const infoModal = ref();

const selected = ref({
    id: undefined
});

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
    if (selected.value.id) {
        emit('update:modelValue', `${selected.value.prefix}-v${selected.value.version}`);
    } else {
        emit('update:modelValue', undefined);
    }
}, {
    deep: true
});

watch(infoModal, async function() {
    if (!infoModal.value) return;

    const readme = await std(`/api/task/${infoModal.value.id}/readme`);

    infoModal.value.readme_body = readme.body;
})

watch(props.modelValue, async function() {
    if (props.modelValue && props.modelValue.id !== selected.value.id) {
        await fetch();
    }
});

watch(paging.value, async () => {
    await listTasks();
});

onMounted(async () => {
    if (props.modelValue) {
        await fetch();
    }

    await listTasks();
    loading.value.main = false;
});

async function fetch() {
    selected.value = await std(`/api/template/${props.modelValue.id}`);
}

async function select(task) {
    loading.value.task = true;

    const detail = await std(`/api/task/raw/${task.prefix}`);
    selected.value = {
        versions: detail.versions,
        version: detail.versions[0],
        ...task
    }

    loading.value.task = false;
}

async function listTasks() {
    loading.value.list = true;
    const url = stdurl('/api/task');
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', paging.value.limit);
    url.searchParams.append('page', paging.value.page);
    list.value = await std(url);

    loading.value.list = false;
}
</script>

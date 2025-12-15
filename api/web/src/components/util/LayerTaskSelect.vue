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
                        <img
                            v-if='selected.logo'
                            :src='selected.logo'
                            alt='Logo Preview'
                            style='height: 50px;'
                            class='img-thumbnail'
                        >
                        <IconBroadcast
                            v-else
                            size='50'
                            stroke='1'
                            class='text-muted'
                        />
                        <div
                            class='mx-2'
                            v-text='selected.name'
                        />
                        <div class='ms-auto btn-list'>
                            <TablerEnum
                                v-model='selected.version'
                                :options='selected.versions'
                            />


                            <TablerIconButton
                                v-if='selected.id'
                                title='Remove Task'
                                @click='selected.id = undefined'
                            >
                                <IconTrash
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
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
                    <div
                        v-else
                        class='row row-cards'
                    >
                        <template
                            v-for='task in list.items'
                        >
                            <div class='col-sm-6 col-lg-3'>
                                <div
                                    class='card card-link cursor-pointer hover'
                                    @click='selected = select(task)'
                                >
                                    <div class='card-header d-flex align-items-center user-select-none'>
                                        <IconStar
                                            v-if='task.favorite'
                                            size='24'
                                            stroke='1'
                                            class='me-2'
                                        />
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
                                    <div class='card-body d-flex align-items-center justify-content-center user-select-none'>
                                        <div style='width: 128px; height: 128px;'>
                                            <img
                                                v-if='task.logo'
                                                :src='task.logo'
                                                alt='Logo Preview'
                                                class='img-thumbnail'
                                            >
                                            <IconBroadcast
                                                v-else
                                                size='128'
                                                stroke='1'
                                                class='text-muted'
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
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
    IconStar,
    IconTrash,
    IconBroadcast,
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
    modelValue: {
        type: String,
        default: undefined
    },
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
    limit: 12,
    sort: 'favorite',
    order: 'desc',
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
    if (props.modelValue) {
        select.value  = await select(props.modelValue.split('-v')[0], props.modelValue.split('-v')[1])
    }
});

watch(paging.value, async () => {
    await listTasks();
});

onMounted(async () => {
    if (props.modelValue) {
        await select(props.modelValue.split('-v')[0], props.modelValue.split('-v')[1])
    }

    await listTasks();
    loading.value.main = false;
});

async function select(task, version) {
    loading.value.task = true;

    const detail = await std(`/api/task/raw/${task.prefix}`);
    selected.value = {
        versions: detail.versions,
        version: version || detail.versions[0],
        ...task
    }

    loading.value.task = false;
}

async function listTasks() {
    loading.value.list = true;
    const url = stdurl('/api/task');
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', paging.value.limit);
    url.searchParams.append('order', paging.value.order);
    url.searchParams.append('sort', paging.value.sort);
    url.searchParams.append('page', paging.value.page);
    list.value = await std(url);

    loading.value.list = false;
}
</script>

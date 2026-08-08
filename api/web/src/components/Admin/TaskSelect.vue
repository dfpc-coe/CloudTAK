<template>
    <TablerDropdown
        class='task-select w-100'
        position='bottom-start'
    >
        <template #default>
            <div class='form-select d-flex align-items-center cursor-pointer user-select-none w-100'>
                <span class='text-truncate flex-fill'>{{ modelValue }}</span>
            </div>
        </template>
        <template #dropdown>
            <div style='min-width: 250px;'>
                <div class='px-3 py-2 border-bottom'>
                    <TablerInput
                        v-model='search'
                        placeholder='Search Tasks...'
                        icon='search'
                        :autofocus='true'
                        class='mb-0'
                        @click.stop
                    />
                </div>
                <div
                    class='overflow-auto px-2 py-2'
                    style='max-height: 300px;'
                >
                    <div
                        v-for='task in filteredTasks'
                        :key='task'
                        class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none rounded'
                        :class='{ "fw-bold": task === modelValue }'
                        @click='select(task)'
                        v-text='task'
                    />
                    <TablerNone
                        v-if='!filteredTasks.length'
                        :compact='true'
                        :create='false'
                        label='No Tasks'
                    />
                </div>
            </div>
        </template>
    </TablerDropdown>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { TablerInput, TablerNone, TablerDropdown } from '@tak-ps/vue-tabler';

const props = defineProps<{
    modelValue: string;
    tasks: string[];
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const ALL_TASKS = 'All Tasks';

const search = ref('');

const filteredTasks = computed(() => {
    const q = search.value.trim().toLowerCase();
    const all = [ALL_TASKS, ...props.tasks];
    if (!q) return all;
    return all.filter((t) => t.toLowerCase().includes(q));
});

function select(task: string): void {
    emit('update:modelValue', task);
    search.value = '';
}
</script>

<style scoped>
.task-select {
    display: flex !important;
    width: 100%;
}

.task-select :deep(> div) {
    width: 100%;
}
</style>

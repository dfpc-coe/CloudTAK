<template>
    <div>
        <div class='card-header'>
            <template v-if='task'>
                <TablerIconButton
                    title='Back'
                    @click='task = null'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <h3
                    class='mx-2 card-title'
                    v-text='task'
                />
            </template>
            <template v-else>
                <h3 class='card-title'>
                    ETL Task Containers
                </h3>
            </template>
            <div class='ms-auto'>
                <div class='btn-list' />
            </div>
        </div>

        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!Object.keys(tasks.items)'
                label='No Tasks'
                :create='false'
            />
            <template v-else-if='task'>
                <TablerNone
                    v-if='!tasks.items[task].length'
                    label='No Versions'
                    :create='false'
                />
                <div
                    v-else
                    class='table-responsive'
                >
                    <table class='table card-table table-hover table-vcenter datatable cursor-pointer'>
                        <tbody>
                            <tr
                                v-for='version in tasks.items[task]'
                                :key='version'
                            >
                                <td>
                                    <div class='d-flex align-items-center'>
                                        <span v-text='version' />
                                        <div class='ms-auto'>
                                            <TablerDelete
                                                displaytype='icon'
                                                @delete='deleteVersion(task, version)'
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div
                    class='position-absolute bottom-0 w-100'
                    style='height: 61px;'
                >
                    <TableFooter
                        :limit='tasks.items[task].length'
                        :total='tasks.items[task].length'
                        @page='0'
                    />
                </div>
            </template>
            <template v-else>
                <div class='table-responsive'>
                    <table class='table card-table table-hover table-vcenter datatable cursor-pointer'>
                        <tbody>
                            <tr
                                v-for='t in Object.keys(tasks.items)'
                                :key='t'
                                @click='task = t'
                            >
                                <td v-text='t' />
                                <td v-text='`${tasks.items[t].length} Versions`' />
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div
                    class='position-absolute bottom-0 w-100'
                    style='height: 61px;'
                >
                    <TableFooter
                        :limit='Object.keys(tasks.items).length'
                        :total='Object.keys(tasks.items).length'
                        @page='0'
                    />
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { ETLRawTaskList } from '../../../../src/types.ts';
import { std } from '../../../../src/std.ts';
import {
    TablerIconButton,
    TablerLoading,
    TablerDelete,
    TablerNone,
} from '@tak-ps/vue-tabler';
import TableFooter from '../../util/TableFooter.vue'
import {
    IconCircleArrowLeft
} from '@tabler/icons-vue';

const loading = ref(true);
const task = ref();
const tasks = ref<ETLRawTaskList>({
    total: 0,
    items: {}
});

onMounted(async () => {
    await fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    tasks.value = await std(`/api/task/raw`) as ETLRawTaskList;
    loading.value = false;
}

async function deleteVersion(task: string, version: string): Promise<void> {
    loading.value = true;
    await std(`/api/task/raw/${task}/version/${version}`, {
        method: 'DELETE'
    });

    await fetch();
}
</script>

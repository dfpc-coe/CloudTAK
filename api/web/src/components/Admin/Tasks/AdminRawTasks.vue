<template>
    <div>
        <div class='card-header'>
            <template v-if='task'>
                <IconCircleArrowLeft
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='task = null'
                />
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
                label='Tasks'
                :create='false'
            />
            <template v-else-if='task'>
                <TablerNone
                    v-if='!tasks.items[task].length'
                    label='Versions'
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

<script>
import { std } from '/src/std.ts';
import {
    TablerLoading,
    TablerDelete,
    TablerNone,
} from '@tak-ps/vue-tabler';
import TableFooter from '../../util/TableFooter.vue'
import {
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'AdminTask',
    components: {
        TablerLoading,
        TablerDelete,
        TablerNone,
        TableFooter,
        IconCircleArrowLeft,
    },
    data: function() {
        return {
            loading: true,
            task: null,
            tasks: {
                total: 0,
                items: {}
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.tasks = await std(`/api/task/raw`);
            this.loading = false;
        },
        deleteVersion: async function(task, version) {
            this.loading = true;
            this.tasks = await std(`/api/task/raw/${task}/version/${version}`, {
                method: 'DELETE'
            });

            await this.fetch();
        }
    }
}
</script>

<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Registered Tasks
            </h1>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"Register New Task"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='edit = {
                        "name": "",
                        "prefix": "",
                        "readme": "",
                        "repo": ""
                    }'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <template v-if='edit'>
                <TablerLoading
                    v-if='loading'
                    desc='Saving Tasks'
                />
                <template v-else>
                    <div class='row g-2 col-12 py-2 px-2'>
                        <TablerInput
                            v-model='edit.name'
                            label='Task Name'
                        />

                        <TablerInput
                            v-model='edit.prefix'
                            :disabled='edit.id'
                            label='Container Prefix'
                        />

                        <TablerInput
                            v-model='edit.repo'
                            label='Task Code Repository URL'
                        />

                        <TablerInput
                            v-model='edit.readme'
                            label='Task Markdown Readme URL'
                        />

                        <div class='col-12 d-flex py-2'>
                            <button
                                class='btn btn-secondary'
                                @click='edit = false'
                            >
                                Cancel
                            </button>
                            <div class='ms-auto btn-list mx-3'>
                                <button
                                    class='btn btn-primary'
                                    @click='saveTask'
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </template>
            </template>
            <template v-else>
                <TablerLoading
                    v-if='loading'
                    desc='Loading Tasks'
                />
                <TablerNone
                    v-else-if='!list.items.length'
                    label='Tasks'
                    :create='false'
                />
                <div
                    v-else
                    class='table-responsive'
                >
                    <table class='table card-table table-hover table-vcenter datatable'>
                        <TableHeader
                            v-model:sort='paging.sort'
                            v-model:order='paging.order'
                            v-model:header='header'
                        />
                        <tbody>
                            <tr
                                v-for='layer in list.items'
                                :key='layer.id'
                                class='cursor-pointer'
                                @click='edit = layer'
                            >
                                <template v-for='h in header'>
                                    <template v-if='h.display'>
                                        <td>
                                            <span v-text='layer[h.name]' />
                                        </td>
                                    </template>
                                </template>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div
                    class='position-absolute bottom-0 w-100'
                    style='height: 61px;'
                >
                    <TableFooter
                        :limit='paging.limit'
                        :total='list.total'
                        @page='paging.page = $event'
                    />
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import { std, stdurl, stdclick } from '/src/std.ts';
import TableHeader from '../../util/TableHeader.vue'
import TableFooter from '../../util/TableFooter.vue'
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue'

export default {
    name: 'RegisteredTasksAdmin',
    components: {
        TablerInput,
        TablerNone,
        IconPlus,
        IconRefresh,
        TablerLoading,
        TableHeader,
        TableFooter,
    },
    data: function() {
        return {
            err: false,
            loading: true,
            header: [],
            edit: false,
            paging: {
                filter: '',
                sort: 'name',
                order: 'asc',
                limit: 100,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
       paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            }
        }
    },
    mounted: async function() {
        await this.listLayerSchema();
        await this.fetchList();
    },
    methods: {
        stdclick,
        listLayerSchema: async function() {
            const schema = await std('/api/schema?method=GET&url=/task');
            this.header = ['name', 'prefix'].map((h) => {
                return { name: h, display: true };
            });

            this.header.push(...schema.query.properties.sort.enum.map((h) => {
                return {
                    name: h,
                    display: false
                }
            }).filter((h) => {
                for (const hknown of this.header) {
                    if (hknown.name === h.name) return false;
                }
                return true;
            }));
        },
        saveTask: async function() {
            this.loading = true;

            if (this.edit.id) {
                await std(`/api/task/${this.edit.id}`, {
                    method: 'PATCH',
                    body: this.edit
                });
            } else {
                await std('/api/task', {
                    method: 'POST',
                    body: this.edit
                });
            }

            this.edit = false

            await this.fetchList();
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/task');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        }
    }
}
</script>

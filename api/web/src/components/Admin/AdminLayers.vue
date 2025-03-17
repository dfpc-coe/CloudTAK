<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Layer Admin
            </h1>

            <div class='ms-auto btn-list'>
                <IconCloudUpload
                    v-tooltip='"Redeploy"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='redeploy'
                />

                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='row g-0 py-2'>
                <div class='col-md-8 px-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter...'
                    />
                </div>
                <div class='col-md-4 px-2'>
                    <TablerEnum
                        v-model='paging.task'
                        default='All Types'
                        :options='taskTypes'
                    />
                </div>
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Layers'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Layers'
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
                            @click='stdclick($router, $event, `/connection/${layer.connection}/layer/${layer.id}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display && h.name === "name"'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <Status :layer='layer' /><span
                                                class='mx-2'
                                                v-text='layer[h.name]'
                                            />
                                        </div>
                                    </td>
                                </template>
                                <template v-else-if='h.display'>
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
        </div>
    </div>
</template>

<script>
import { std, stdurl, stdclick } from '/src/std.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import Status from '../Layer/utils/StatusDot.vue';
import {
    TablerNone,
    TablerInput,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCloudUpload,
} from '@tabler/icons-vue'

export default {
    name: 'LayerAdmin',
    components: {
        Status,
        TablerNone,
        TablerEnum,
        TablerInput,
        TablerLoading,
        IconRefresh,
        IconCloudUpload,
        TableHeader,
        TableFooter,
    },
    data: function() {
        return {
            err: false,
            loading: true,
            header: [],
            paging: {
                filter: '',
                task: 'All Types',
                sort: 'name',
                order: 'asc',
                limit: 100,
                page: 0
            },
            list: {
                total: 0,
                tasks: [],
                items: []
            }
        }
    },
    computed: {
        taskTypes: function() {
            return ["All Types"].concat(this.list.tasks)
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
        redeploy: async function() {
            this.loading = true;
            this.stack = await std(`/api/layer/redeploy`, {
                method: 'POST'
            });
            this.loading = false;
        },
        listLayerSchema: async function() {
            const schema = await std('/api/schema?method=GET&url=/layer');
            this.header = ['id', 'name', 'cron', 'task'].map((h) => {
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
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/layer');
            url.searchParams.append('alarms', 'true');
            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('sort', this.paging.sort);
            url.searchParams.append('order', this.paging.order);
            url.searchParams.append('page', this.paging.page);

            if (this.paging.task !== 'All Types') {
                url.searchParams.append('task', this.paging.task);
            }

            this.list = await std(url);
            this.loading = false;
        }
    }
}
</script>

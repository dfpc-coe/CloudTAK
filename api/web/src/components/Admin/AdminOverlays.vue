<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Server Overlay Admin
            </h1>

            <div class='ms-auto btn-list'>
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
            <TablerInput
                v-model='paging.filter'
                placeholder='Filter...'
                class='mx-1 my-2'
            />

            <TablerLoading
                v-if='loading'
                desc='Loading Overlays'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Overlays'
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
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCloudUpload,
} from '@tabler/icons-vue'

export default {
    name: 'OverlayAdmin',
    components: {
        Status,
        TablerNone,
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
        await this.listOverlaySchema();
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
        listOverlaySchema: async function() {
            const schema = await std('/api/schema?method=GET&url=/overlay');
            this.header = ['id', 'name'].map((h) => {
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
            const url = stdurl('/api/overlay');
            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        }
    }
}
</script>

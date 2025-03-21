<template>
    <div>
        <div class='card-header d-flex'>
            <h2 class='card-title'>
                Layers
            </h2>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"Create Layer"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='$router.push(`/connection/${$route.params.connectionid}/layer/new`)'
                />

                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='listLayers'
                />
            </div>
        </div>

        <div style='min-height: 20vh; margin-bottom: 60px'>
            <TablerAlert
                v-if='err'
                title='ETL Server Error'
                :err='err'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                label='Layers'
            />
            <div
                v-else
                class='table-resposive'
            >
                <table class='table card-table table-vcenter datatable table-hover'>
                    <thead>
                        <tr>
                            <th>Name</th>
                        </tr>
                    </thead>
                    <tbody class='table-tbody'>
                        <tr
                            v-for='layer of list.items'
                            :key='layer.id'
                            class='cursor-pointer'
                            @click='$router.push(`/connection/${$route.params.connectionid}/layer/${layer.id}`)'
                        >
                            <td>
                                <div class='d-flex align-items-center'>
                                    <LayerStatus :layer='layer' /><div
                                        class='mx-2'
                                        v-text='layer.name'
                                    />

                                    <div class='ms-auto btn-list'>
                                        <IconDatabase
                                            v-if='layer.data'
                                            v-tooltip='`Pushing to Data Sync`'
                                            :size='32'
                                            stroke='1'
                                            @click.stop.prevent='$router.push(`/connection/${$route.params.connectionid}/data/${layer.data}`)'
                                        />                                
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div
            class='position-absolute bottom-0 w-100'
            style='height: 60px;'
        >
            <TableFooter
                :limit='paging.limit'
                :total='list.total'
                @page='paging.page = $event'
            />
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import TableFooter from '../util/TableFooter.vue';
import {
    IconPlus,
    IconRefresh,
    IconDatabase
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler'
import LayerStatus from '../Layer/utils/StatusDot.vue';

export default {
    name: 'ConnectionLayers',
    components: {
        TablerNone,
        TablerAlert,
        IconPlus,
        IconRefresh,
        IconDatabase,
        TablerLoading,
        TableFooter,
        LayerStatus,
    },
    props: {
        connection: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            loading: true,
            err: null,
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                items: []
            },
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.listLayers();
            },
        }
    },
    mounted: async function() {
        await this.listLayers();
    },
    methods: {
        listLayers: async function() {
            this.loading = true;
            try {
                const url = stdurl(`/api/connection/${this.$route.params.connectionid}/layer`);
                url.searchParams.append('alarms', String(true));
                url.searchParams.append('limit', this.paging.limit);
                url.searchParams.append('page', this.paging.page);
                url.searchParams.append('filter', this.paging.filter);
                this.list = await std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading = false
        }
    }
}
</script>

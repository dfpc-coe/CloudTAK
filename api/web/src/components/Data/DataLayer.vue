<template>
<div>
    <div class='card-header d-flex'>
        <h2 class='card-title'>Layers</h2>

        <div class='ms-auto btn-list'>
            <IconPlus
                v-tooltip='"Create Layer"'
                @click='$router.push(
                    `/connection/${$route.params.connectionid}/data/${$route.params.dataid}/layer/new`
                )'
                size='32'
                class='cursor-pointer'
            />
        </div>
    </div>

    <div style='min-height: 20vh; margin-bottom: 61px'>
        <Alert v-if='err' title='ETL Server Error' :err='err.message'/>
        <TablerLoading v-else-if='loading'/>
        <TablerNone v-else-if='!list.items.length' :create='false' label='Layers'/>
        <div v-else class='table-resposive'>
            <table class='table card-table table-vcenter datatable table-hover'>
                <thead>
                    <tr>
                        <th>Name</th>
                    </tr>
                </thead>
                <tbody class='table-tbody'>
                    <tr @click='$router.push(`/connection/${$route.params.connectionid}/layer/${layer.id}`)' :key='layer.id' v-for='layer of list.items' class='cursor-pointer'>
                        <td>
                            <div class='d-flex align-items-center'>
                                <LayerStatus :layer='layer'/><div class='mx-2' v-text='layer.name'></div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div class='position-absolute bottom-0 w-100' style='height: 61px;'>
        <TableFooter :limit='paging.limit' :total='list.total' @page='paging.page = $event'/>
    </div>
</div>

</template>

<script>
import { std, stdurl } from '/src/std.ts';
import TableFooter from '../util/TableFooter.vue';
import Alert from '../util/Alert.vue';
import {
    IconPlus
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler'
import LayerStatus from '../Layer/utils/Status.vue';

export default {
    name: 'DataLayers',
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
    mounted: async function() {
        await this.listLayers();
    },
    watch: {
       'paging.page': async function() {
           await this.listLayers();
       },
       'paging.filter': async function() {
           await this.listLayers();
       },
    },
    methods: {
        listLayers: async function() {
            this.loading = true;
            try {
                const url = stdurl('/api/layer');
                url.searchParams.append('data', this.$route.params.dataid);
                url.searchParams.append('limit', this.paging.limit);
                url.searchParams.append('page', this.paging.page);
                url.searchParams.append('filter', this.paging.filter);
                this.list = await std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading = false
        }
    },
    components: {
        TablerNone,
        Alert,
        IconPlus,
        TablerLoading,
        TableFooter,
        LayerStatus,
    }
}
</script>

<template>
<div>
    <div class='card-header d-flex'>
        <h2 class='card-title'>Layers</h2>

        <div class='ms-auto btn-list'>
            <IconPlus v-tooltip='"Create Layer"' @click='$router.push("/layer/new")' class='cursor-pointer'/>
        </div>
    </div>

    <Alert v-if='err' title='ETL Server Error' :err='err.message' :compact='true'/>
    <TablerLoading v-else-if='loading'/>
    <TablerNone v-else-if='!list.layers.length' :create='false' label='Layers' :compact='true'/>
    <div v-else class='table-resposive'>
        <table class='table card-table table-vcenter datatable table-hover'>
            <thead>
                <tr>
                    <th>Name</th>
                </tr>
            </thead>
            <tbody class='table-tbody'>
                <tr @click='$router.push(`/layer/${layer.id}`)' :key='layer.id' v-for='layer of list.layers' class='cursor-pointer'>
                    <td>
                        <div class='d-flex align-items-center'>
                            <LayerStatus :layer='layer'/><div class='mx-2' v-text='layer.name'></div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>

        <div class='position-absolute bottom-0 start-0 end-0'>
            <TableFooter :limit='paging.limit' :total='list.total' @page='paging.page = $event'/>
        </div>
    </div>
</div>

</template>

<script>
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
    name: 'ConnectionLayers',
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
                layers: []
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
                const url = window.stdurl('/api/layer');
                url.searchParams.append('connection', this.connection.id);
                url.searchParams.append('limit', this.paging.limit);
                url.searchParams.append('page', this.paging.page);
                url.searchParams.append('filter', this.paging.filter);
                this.list = await window.std(url);
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

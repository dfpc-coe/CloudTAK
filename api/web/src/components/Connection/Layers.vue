<template>
<div class="card">
    <div class='card-header'>Layers</div>

    <None v-if='!list.layers.length' :create='false' label='Layers'/>
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
                        <div class='d-flex'>
                            <span class='mt-2' v-text='layer.name'/>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        <TableFooter :limit='paging.limit' :total='list.total' @page='paging.page = $event'/>
    </div>
</div>

</template>

<script>
import TableFooter from '../util/TableFooter.vue';
import None from '../cards/None.vue';

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
            const url = window.stdurl('/api/layer');
            url.searchParams.append('connection', this.connection.id);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            url.searchParams.append('filter', this.paging.filter);
            this.list = await window.std(url);
        }
    },
    components: {
        None,
        TableFooter,
    }
}
</script>

<template>
<div class="card">
    <div class='card-header'>Connection Links</div>

    <None v-if='!list.sinks.length' :create='false' label='Layers'/>
    <div v-else class='table-resposive'>
        <table class='table card-table table-vcenter datatable table-hover'>
            <thead>
                <tr>
                    <th>Name</th>
                </tr>
            </thead>
            <tbody class='table-tbody'>
                <tr @click='$router.push(`/connection/${connection.id}/sink/${sink.id}`)' :key='sink.id' v-for='sink of list.sinks' class='cursor-pointer'>
                    <td>
                        <div class='d-flex'>
                            <span class='mt-2' v-text='sink.name'/>
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
                sinks: []
            },
        }
    },
    mounted: async function() {
        await this.listSinks();
    },
    watch: {
       'paging.page': async function() {
           await this.listSinks();
       },
       'paging.filter': async function() {
           await this.listSinks();
       },
    },
    methods: {
        listLayers: async function() {
            const url = window.stdurl(`/api/connection/${this.connection.id}/sink`);
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

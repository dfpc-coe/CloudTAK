<template>
<div>
    <div class='card-header d-flex'>
        Data Stores

        <div class='ms-auto'>
            <IconPlus @click='$router.push("/data/new")' v-tooltip='"Create Store"' class='cursor-pointer'/>
        </div>
    </div>

    <Alert v-if='err' title='ETL Server Error' :err='err.message' :compact='true'/>
    <TablerLoading v-else-if='loading'/>
    <TablerNone v-else-if='!list.sinks.length' :create='false' label='Data'/>
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
import Alert from '../util/Alert.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    IconPlus
} from '@tabler/icons-vue';

export default {
    name: 'ConnectionSinks',
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
        listSinks: async function() {
            this.loading = true;
            try {
                const url = window.stdurl(`/api/connection/${this.connection.id}/sink`);
                url.searchParams.append('limit', this.paging.limit);
                url.searchParams.append('page', this.paging.page);
                url.searchParams.append('filter', this.paging.filter);
                this.list = await window.std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        Alert,
        IconPlus,
        TablerLoading,
        TableFooter,
    }
}
</script>

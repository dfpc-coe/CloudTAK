<template>
<div>
    <div class='card-header d-flex'>
        Data Stores

        <div class='ms-auto'>
            <IconPlus @click='$router.push(`/connection/${connection.id}/data/new`)' v-tooltip='"Create Store"' class='cursor-pointer'/>
        </div>
    </div>

    <Alert v-if='err' title='ETL Server Error' :err='err.message' :compact='true'/>
    <TablerLoading v-else-if='loading'/>
    <TablerNone v-else-if='!list.data.length' :create='false' label='Data'/>
    <div v-else class='table-resposive'>
        <table class='table card-table table-vcenter datatable table-hover'>
            <thead>
                <tr>
                    <th>Name</th>
                </tr>
            </thead>
            <tbody class='table-tbody'>
                <tr @click='$router.push(`/connection/${connection.id}/data/${data.id}`)' :key='data.id' v-for='data of list.data' class='cursor-pointer'>
                    <td>
                        <div class='d-flex'>
                            <span class='mt-2' v-text='data.name'/>
                            <div class='ms-auto'>
                                <IconAccessPoint @click='modal.mission = true' v-if='data.mission' class='cursor-pointer text-green' v-tooltip='"Mission Sync On"'/>
                                <IconAccessPointOff @click='modal.mission = true' v-else class='cursor-pointer text-red' v-tooltip='"Mission Sync Off"'/>
                            </div>
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
    IconAccessPoint,
    IconAccessPointOff,
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
                data: []
            },
        }
    },
    mounted: async function() {
        await this.listData();
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.listData();
            },
        }
    },
    methods: {
        listData: async function() {
            this.loading = true;
            try {
                const url = window.stdurl(`/api/data`);
                url.searchParams.append('limit', this.paging.limit);
                url.searchParams.append('page', this.paging.page);
                url.searchParams.append('filter', this.paging.filter);
                url.searchParams.append('connection', this.$route.params.connectionid);
                this.list = await window.std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        }
    },
    components: {
        IconAccessPoint,
        IconAccessPointOff,
        TablerNone,
        Alert,
        IconPlus,
        TablerLoading,
        TableFooter,
    }
}
</script>

<template>
<div>
    <div class='card-header d-flex'>
        Data Stores

        <div class='ms-auto btn-list'>
            <IconPlus @click='$router.push(`/connection/${connection.id}/data/new`)' v-tooltip='"Create Store"' size='32' class='cursor-pointer'/>
            <IconRefresh @click='listData' v-tooltip='"Refresh"' size='32' class='cursor-pointer'/>
        </div>
    </div>

    <div style='min-height: 20vh; margin-bottom: 61px'>
        <Alert v-if='err' title='ETL Server Error' :err='err.message' :compact='true'/>
        <TablerLoading v-else-if='loading'/>
        <TablerNone v-else-if='!list.items.length' :create='false' label='Data'/>
        <div v-else class='table-resposive'>
            <table class='table card-table table-vcenter datatable table-hover'>
                <thead>
                    <tr>
                        <th>Name</th>
                    </tr>
                </thead>
                <tbody class='table-tbody'>
                    <tr @click='$router.push(`/connection/${connection.id}/data/${data.id}`)' :key='data.id' v-for='data of list.items' class='cursor-pointer'>
                        <td>
                            <div class='d-flex'>
                                <span class='mt-2' v-text='data.name'/>
                                <div class='ms-auto'>
                                    <IconAccessPoint v-if='data.mission_sync' size='32' class='cursor-pointer text-green' v-tooltip='"Mission Sync On"'/>
                                    <IconAccessPointOff v-else size='32' class='cursor-pointer text-red' v-tooltip='"Mission Sync Off"'/>
                                </div>
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
import TableFooter from '../util/TableFooter.vue';
import Alert from '../util/Alert.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    IconAccessPoint,
    IconAccessPointOff,
    IconRefresh,
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
                items: []
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
                const url = window.stdurl(`/api/connection/${this.$route.params.connectionid}/data`);
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
        IconRefresh,
        IconPlus,
        TablerNone,
        Alert,
        TablerLoading,
        TableFooter,
    }
}
</script>

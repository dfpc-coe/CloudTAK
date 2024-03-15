<template>
<div>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Data Transforms</h3>
        <div class='ms-auto btn-list'>
            <IconRefresh @click='fetchList' size='32' class='cursor-pointer'/>
        </div>
    </div>

    <div v-if='!loading.list && list.items.length' class='table-responsive'>
        <table class="table table-vcenter card-table table-hover">
            <thead>
                <tr>
                    <th>Asset</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                <tr @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/job/${job.id}`)' :key='job.created' v-for='job in list.items' class='cursor-pointer'>
                    <td v-text='job.asset'></td>
                    <td v-text='job.status'></td>
                    <td>
                        <TablerEpoch :date='job.created'/>
                    </td>
                    <td class='d-flex'>
                        <TablerEpoch v-if='job.updated' :date='job.updated'/>
                        <span v-else>-</span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div v-else class='card-body'>
        <template v-if='err'>
            <Alert title='Transforms Error' :err='err.message' :compact='true'/>
        </template>
        <TablerLoading v-else-if='loading.list'/>
        <TablerNone v-else-if='!list.items.length' :create='false' :compact='true'/>
    </div>
</div>
</template>

<script>
import Alert from '../util/Alert.vue';
import {
    IconRefresh
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading,
    TablerEpoch
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataJobs',
    data: function() {
        return {
            err: null,
            loading: {
                list: true
            },
            list: {
                total: 0,
                items: []
            }
        };
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            try {
                this.loading.list = true;
                this.err = null;
                const list = await window.std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/job`);
                list.items = list.items.map((l) => {
                    if (l.status === 'SUBMITTED') l.status = 'Unknown';
                    if (l.status === 'PENDING') l.status = 'Pending';
                    if (l.status === 'RUNNABLE') l.status = 'Pending';
                    if (l.status === 'STARTING') l.status = 'Pending';
                    if (l.status === 'RUNNING') l.status = 'Warn';
                    if (l.status === 'FAILED') l.status = 'Fail';
                    if (l.status === 'SUCCEEDED') l.status = 'Success';
                    return l;
                });

                this.list = list;
                this.loading.list = false;
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        TablerNone,
        Alert,
        IconRefresh,
        TablerLoading,
        TablerEpoch,
    }
}
</script>

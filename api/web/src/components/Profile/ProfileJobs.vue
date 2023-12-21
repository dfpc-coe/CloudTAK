<template>
<div>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Asset Transforms</h3>
        <div class='ms-auto btn-list'>
            <IconRefresh @click='fetchList' class='cursor-pointer'/>
        </div>
    </div>

    <div v-if='!loading.list && list.list.length' class='table-responsive'>
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
                <tr @click='$router.push(`/profile/job/${job.id}`)' :key='job.created' v-for='job in list.list' class='cursor-pointer'>
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
        <TablerNone v-else-if='!list.list.length' :create='false' :compact='true'/>
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
    name: 'ProfileJobs',
    data: function() {
        return {
            err: null,
            loading: {
                list: true
            },
            list: {
                total: 0,
                list: []
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
                this.list = await window.std(`/api/profile/job`);
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

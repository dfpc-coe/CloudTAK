<template>
<div class='card'>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Data Transforms</h3>
        <div class='ms-auto btn-list'>
            <RefreshIcon @click='fetchList' class='cursor-pointer'/>
        </div>
    </div>

    <div v-if='!loading.list && list.list.length'>
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
                <tr @click='$router.push(`/data/${$route.params.dataid}/job/${job.id}`)' :key='job.created' v-for='job in list.list' class='cursor-pointer'>
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
        <TablerLoading v-if='loading.list'/>
        <None v-else-if='!list.list.length' :create='false'/>
    </div>
</div>
</template>

<script>
import None from '../cards/None.vue';
import {
    RefreshIcon
} from 'vue-tabler-icons';
import {
    TablerLoading,
    TablerEpoch
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataTransforms',
    data: function() {
        return {
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
            this.loading.list = true;
            this.list = await window.std(`/api/data/${this.$route.params.dataid}/job`);
            this.loading.list = false;
        }
    },
    components: {
        None,
        RefreshIcon,
        TablerLoading,
        TablerEpoch,
    }
}
</script>

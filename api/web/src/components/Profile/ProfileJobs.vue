<template>
<div>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Asset Transforms</h3>
        <div class='ms-auto btn-list'>
            <IconRefresh @click='fetchList' size='32' class='cursor-pointer'/>
        </div>
    </div>

    <div v-if='!loading.list && list.items.length' class='table-responsive'>
        <table class="table table-vcenter card-table table-hover">
            <thead>
                <tr>
                    <th>Asset</th>
                    <th>Created</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                <tr @click='$router.push(`/profile/job/${job.id}`)' :key='job.created' v-for='job in list.items' class='cursor-pointer'>
                    <td>
                        <div class='d-flex align-items-center'>
                            <Status :status='job.status'/>
                            <span v-text='job.asset' class='mx-2'/>
                        </div>
                    </td>
                    <td>
                        <TablerEpoch :date='job.created'/>
                    </td>
                    <td>
                        <TablerEpoch v-if='job.updated' :date='job.updated'/>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div v-else class='card-body'>
        <template v-if='err'>
            <TablerAlert title='Transforms Error' :err='err' :compact='true'/>
        </template>
        <TablerLoading v-else-if='loading.list'/>
        <TablerNone v-else-if='!list.items.length' :create='false' :compact='true'/>
    </div>
</div>
</template>

<script>
import { std } from '/src/std.ts';
import Status from '../util/Status.vue';
import {
    IconRefresh
} from '@tabler/icons-vue';
import {
    TablerAlert,
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
                const list = await std(`/api/profile/job`);
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
        Status,
        TablerAlert,
        IconRefresh,
        TablerLoading,
        TablerEpoch,
    }
}
</script>

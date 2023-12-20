<template>
<div>
    <div class="card-header">
        <IconCircleArrowLeft @click='$router.push("/profile/jobs")' class='cursor-pointer' v-tooltip='"Back"'/>
        <h2 class='card-title'>Job Logs</h2>
        <div class='ms-auto'>
            <div class='btn-list'>
                <IconRefresh @click='fetchLogs' class='cursor-pointer'/>
            </div>
        </div>
    </div>
    <div class="card-body">
        <TablerLoading v-if='loading.logs || loading.job' desc='Loading Job Logs'/>
        <template v-else>
            <pre v-text='logs'></pre>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerLoading,
} from '@tak-ps/vue-tabler'
import {
    IconRefresh
} from '@tabler/icons-vue';

export default {
    name: 'ProfileJob',
    data: function() {
        return {
            err: false,
            loading: {
                job: true,
                logs: true
            },
            job: {},
            logs: ''
        }
    },
    mounted: async function() {
        await this.fetch();
        await this.fetchLogs();
    },
    methods: {
        fetch: async function() {
            this.loading.job = true;
            this.job = await window.std(`/api/profile/job/${this.$route.params.jobid}`);
            this.loading.job = false;
        },
        fetchLogs: async function() {
            this.loading.logs = true;
            this.logs = (await window.std(`/api/profile/job/${this.$route.params.jobid}/logs`))
                .logs
                .map((log) => { return log.message })
                .join('\n');

            this.loading.logs = false;
        }
    },
    components: {
        IconRefresh,
        TablerLoading,
    }
}
</script>

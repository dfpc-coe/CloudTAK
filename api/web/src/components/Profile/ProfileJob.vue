<template>
    <div>
        <div class='card-header'>
            <IconCircleArrowLeft
                v-tooltip='"Back"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='$router.push("/profile/jobs")'
            />
            <Status :status='job.status' />
            <h2 class='card-title mx-2'>
                Job Logs
            </h2>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <IconRefresh
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                        @click='fetchLogs'
                    />
                </div>
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading
                v-if='loading.logs || loading.job'
                desc='Loading Job Logs'
            />
            <TablerNone
                v-else-if='!logs.length'
                label='Logs'
                :create='false'
            />
            <template v-else>
                <pre v-text='logs' />
            </template>
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerLoading,
    TablerNone,
} from '@tak-ps/vue-tabler'
import Status from '../util/Status.vue';
import {
    IconRefresh,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'ProfileJob',
    components: {
        Status,
        IconRefresh,
        IconCircleArrowLeft,
        TablerLoading,
        TablerNone
    },
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
            const job = await std(`/api/profile/job/${this.$route.params.jobid}`);
            if (job.status === 'SUBMITTED') job.status = 'Unknown';
            if (job.status === 'PENDING') job.status = 'Pending';
            if (job.status === 'RUNNABLE') job.status = 'Pending';
            if (job.status === 'STARTING') job.status = 'Pending';
            if (job.status === 'RUNNING') job.status = 'Warn';
            if (job.status === 'FAILED') job.status = 'Fail';
            if (job.status === 'SUCCEEDED') job.status = 'Success';
            this.job = job;

            this.loading.job = false;
        },
        fetchLogs: async function() {
            this.loading.logs = true;
            this.logs = (await std(`/api/profile/job/${this.$route.params.jobid}/logs`))
                .logs
                .map((log) => { return log.message })
                .join('\n');

            this.loading.logs = false;
        }
    }
}
</script>

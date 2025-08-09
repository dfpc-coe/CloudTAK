<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <TablerLoading
            v-if='loading.logs || loading.job'
            desc='Loading Job Logs'
        />
        <div
            v-else
            class='page-body'
        >
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='card-header'>
                                <h2 class='card-title'>
                                    Job Logs
                                </h2>

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <IconRefresh
                                            :size='32'
                                            stroke='1'
                                            class='cursor-pointer'
                                            @click='fetchLogs'
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class='card-body'>
                                <TablerNone
                                    v-if='!logs.length'
                                    label='Logs'
                                    :create='false'
                                />
                                <pre
                                    v-else
                                    v-text='logs'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <PageFooter />
    </div>
</template>

<script>
import { std } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import {
    TablerNone,
    TablerLoading,
    TablerBreadCrumb
} from '@tak-ps/vue-tabler'
import {
    IconRefresh
} from '@tabler/icons-vue';

export default {
    name: 'DataJob',
    components: {
        PageFooter,
        IconRefresh,
        TablerNone,
        TablerLoading,
        TablerBreadCrumb
    },
    data: function() {
        return {
            err: false,
            loading: {
                job: true,
                logs: true
            },
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
            this.data = await std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/job/${this.$route.params.jobid}`);
            this.loading.job = false;
        },
        fetchLogs: async function() {
            this.loading.logs = true;
            this.logs = (await std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/job/${this.$route.params.jobid}/logs`))
                .logs
                .map((log) => { return log.message })
                .join('\n');

            this.loading.logs = false;
        }
    }
}
</script>

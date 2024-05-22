<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Deployment
            </h3>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <IconPlayerPlay
                        v-tooltip='"Manually Run"'
                        size='24'
                        class='cursor-pointer'
                        @click='invoke'
                    />

                    <IconCloudUpload
                        v-tooltip='"Redeploy"'
                        size='24'
                        class='cursor-pointer'
                        @click='redeploy'
                    />

                    <IconRefresh
                        v-tooltip='"Refresh"'
                        size='24'
                        class='cursor-pointer'
                        @click='$emit("stack")'
                    />
                </div>
            </div>
        </div>

        <div class='card-body'>
            <template v-if='loading.full'>
                <TablerLoading />
            </template>
            <template v-else-if='errors.cloudformation'>
                <TablerAlert
                    title='AWS CloudFormation Error'
                    :err='new Error(errors.cloudformation.message)'
                    :compact='true'
                />

                <div class='d-flex justify-content-center my-3'>
                    <div
                        class='btn btn-secondary'
                        @click='refresh'
                    >
                        Refresh
                    </div>
                </div>
            </template>
            <template v-else-if='errors.cloudwatch'>
                <TablerAlert
                    title='AWS CloudWatch Error'
                    :err='new Error(errors.cloudwatch.message)'
                    :compact='true'
                />

                <div class='d-flex justify-content-center my-3'>
                    <div
                        class='btn btn-secondary'
                        @click='refresh'
                    >
                        Refresh
                    </div>
                </div>
            </template>
            <template v-else-if='stack.status === "DOES_NOT_EXIST_COMPLETE"'>
                <div class='d-flex justify-content-center mb-4'>
                    Stack Hasn't Deployed
                </div>
                <div class='d-flex justify-content-center mb-4'>
                    <div
                        class='btn btn-primary'
                        @click='postStack'
                    >
                        Deploy Stack
                    </div>
                </div>
            </template>
            <template v-else>
                <label class='subheader'>Stack Status</label>
                <pre v-text='stack.status' />
                <label class='subheader'>Layer Runtime Logs</label>
                <pre v-text='logs' />
            </template>
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlayerPlay,
    IconRefresh,
    IconCloudUpload,
} from '@tabler/icons-vue';

export default {
    name: 'LayerDeployment',
    components: {
        TablerAlert,
        IconPlayerPlay,
        IconRefresh,
        TablerLoading,
        IconCloudUpload,
    },
    props: {
        stack: {
            type: Object,
            required: true
        }
    },
    emits: [
        'stack'
    ],
    data: function() {
        return {
            looping: false,
            errors: {
                cloudwatch: false
            },
            loading: {
                full: true,
                small: true
            },
            logs: {}
        };
    },
    mounted: async function() {
        await this.init();
    },
    unmounted: function() {
        this.clear()
    },
    methods: {
        init: async function() {
            await this.fetchLogs();
            this.looping = setInterval(() => {
                this.fetchLogs(false);
            }, 10 * 1000);
        },
        clear: function() {
            if (this.looping) clearInterval(this.looping);
        },
        refresh: async function() {
            await this.fetchLogs();
        },
        invoke: async function() {
            this.loading.full = true;
            await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task/invoke`, {
                method: 'POST'
            });
            this.loading.full = false;
        },
        redeploy: async function(showLoading=true) {
            if (showLoading) {
                this.loading.full = true;
            } else {
                this.loading.small = true;
            }

            this.errors.cloudformation = false;

            try {
                await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/redeploy`, {
                    method: 'POST'
                });

                this.$emit('stack');
            } catch (err) {
                this.errors.cloudformation = err;
            }

            this.loading.full = false;
            this.loading.small = false;
        },
        fetchLogs: async function(showLoading=true) {
            if (showLoading) {
                this.loading.full = true;
            } else {
                this.loading.small = true;
            }

            this.errors.cloudwatch = false;

            try {
                this.logs = (await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task/logs`))
                    .logs
                    .map((log) => { return log.message })
                    .reverse()
                    .join('\n');
            } catch (err) {
                this.errors.cloudwatch = err;
            }

            this.loading.full = false;
            this.loading.small = false;
        },
        postStack: async function() {
            this.loading.full = true;
            await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task`, {
                method: 'POST'
            });

            this.$emit('stack');

            this.loading.full = false;
        }
    }
}
</script>

<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>Layer Deployment</h3>
        <div class='ms-auto'>
            <div class='btn-list'>
                <IconPlayerPlay
                    v-if='mode !== "logs"'
                    @click='invoke'
                    v-tooltip='"Manually Run"'
                    width='24' height='24'
                    class='cursor-pointer'
                />

                <IconArticle
                    v-if='mode !== "logs"'
                    @click='mode = "logs"'
                    v-tooltip='"View Logs"'
                    width='24' height='24'
                    class='cursor-pointer'
                />

                <IconCloudUpload
                    v-if='mode !== "logs"'
                    @click='redeploy'
                    v-tooltip='"Redeploy"'
                    width='24' height='24'
                    class='cursor-pointer'
                />

                <IconCircleDot
                    v-if='mode !== "status"'
                    @click='mode = "status"'
                    v-tooltip='"View Stack"'
                    width='24' height='24'
                    class='cursor-pointer'
                />

                <IconRefresh
                    v-if='!loading.small'
                    @click='refresh'
                    v-tooltip='"Refresh"'
                    width='24' height='24'
                    class='cursor-pointer'
                />
                <div v-else class='d-flex justify-content-center'>
                    <div class="spinner-border" role="status"></div>
                </div>
            </div>
        </div>
    </div>

    <div class='card-body'>
        <template v-if='loading.full'>
            <TablerLoading/>
        </template>
        <template v-else-if='mode === "status" && errors.cloudformation'>
            <Alert title='AWS CloudFormation Error' :err='errors.cloudformation.message' :compact='true'/>

            <div class="d-flex justify-content-center my-3">
                <div @click='refresh' class='btn btn-secondary'>Refresh</div>
            </div>
        </template>
        <template v-else-if='mode === "logs" && errors.cloudwatch'>
            <Alert title='AWS CloudWatch Error' :err='errors.cloudwatch.message' :compact='true'/>

            <div class="d-flex justify-content-center my-3">
                <div @click='refresh' class='btn btn-secondary'>Refresh</div>
            </div>
        </template>
        <template v-else-if='stack.status === "destroyed"'>
            <div class="d-flex justify-content-center mb-4">
                Stack Hasn't Deployed
            </div>
            <div class="d-flex justify-content-center mb-4">
                <div @click='postStack' class='btn btn-primary'>Deploy Stack</div>
            </div>
        </template>
        <template v-else-if='mode === "status"'>
            <pre v-text='stack.status'/>
        </template>
        <template v-else-if='mode === "logs"'>
            <pre v-text='logs'/>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Alert from '../util/Alert.vue';
import {
    IconArticle,
    IconPlayerPlay,
    IconCircleDot,
    IconRefresh,
    IconCloudUpload,
} from '@tabler/icons-vue';

export default {
    name: 'LayerDeployment',
    data: function() {
        return {
            mode: 'status',
            looping: false,
            errors: {
                cloudformation: false,
                cloudwatch: false
            },
            loading: {
                full: true,
                small: true
            },
            stack: {},
            logs: {}
        };
    },
    mounted: async function() {
        await this.init();
    },
    unmounted: function() {
        this.clear()
    },
    watch: {
        mode: async function() {
            this.clear();
            await this.init();
        }
    },
    methods: {
        init: async function() {
            if (this.mode === 'status') {
                await this.fetchStatus();
                this.looping = setInterval(() => {
                    this.fetchStatus(false);
                }, 10 * 1000);
            } else if (this.mode === 'logs') {
                await this.fetchLogs();
                this.looping = setInterval(() => {
                    this.fetchLogs(false);
                }, 10 * 1000);
            }
        },
        clear: function() {
            if (this.looping) clearInterval(this.looping);
        },
        refresh: async function() {
            if (this.mode === 'logs') await this.fetchLogs();
            if (this.mode === 'status') await this.fetchStatus();
        },
        invoke: async function() {
            this.loading.full = true;
            await window.std(`/api/layer/${this.$route.params.layerid}/task/invoke`, {
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
                this.stack = await window.std(`/api/layer/${this.$route.params.layerid}/redeploy`, {
                    method: 'POST'
                });
            } catch (err) {
                this.errors.cloudformation = err;
            }

            this.loading.full = false;
            this.loading.small = false;
        },
        fetchStatus: async function(showLoading=true) {
            if (showLoading) {
                this.loading.full = true;
            } else {
                this.loading.small = true;
            }

            this.errors.cloudformation = false;

            try {
                this.stack = await window.std(`/api/layer/${this.$route.params.layerid}/task`);
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
                this.logs = (await window.std(`/api/layer/${this.$route.params.layerid}/task/logs`))
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
            this.stack = await window.std(`/api/layer/${this.$route.params.layerid}/task`, {
                method: 'POST'
            });
            this.loading.full = false;
        }
    },
    components: {
        Alert,
        IconArticle,
        IconPlayerPlay,
        IconCircleDot,
        IconRefresh,
        TablerLoading,
        IconCloudUpload,
    }
}
</script>

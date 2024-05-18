<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Config
            </h3>
            <div class='ms-auto btn-list'>
                <IconSettings
                    v-if='disabled'
                    size='32'
                    class='cursor-pointer'
                    @click='disabled = false'
                />
            </div>
        </div>

        <TablerLoading
            v-if='loading.save'
            desc='Saving Config'
        />
        <TablerLoading
            v-else-if='loading.init'
            desc='Loading Config'
        />
        <div
            v-else
            class='card-body'
        >
            <div class='row g-4'>
                <div class='col-md-4'>
                    <div class='d-flex'>
                        <label class='form-label'>Cron Expression</label>
                        <div
                            v-if='!disabled'
                            class='ms-auto'
                        >
                            <div class='dropdown'>
                                <div
                                    id='dropdownCron'
                                    class='dropdown-toggle'
                                    type='button'
                                    data-bs-toggle='dropdown'
                                    aria-expanded='false'
                                >
                                    <IconSettings
                                        size='16'
                                        class='cursor-pointer dropdown-toggle'
                                    />
                                </div>
                                <ul
                                    class='dropdown-menu px-1 py-1'
                                    aria-labelledby='dropdownCron'
                                >
                                    <li
                                        class='py-1'
                                        @click='config.cron = "rate(1 minute)"'
                                    >
                                        rate(1 minute)
                                    </li>
                                    <li
                                        class='py-1'
                                        @click='config.cron = "rate(5 minutes)"'
                                    >
                                        rate(5 minutes)
                                    </li>
                                    <li
                                        class='py-1'
                                        @click='config.cron = "cron(15 10 * * ? *)"'
                                    >
                                        cron(15 10 * * ? *)
                                    </li>
                                    <li
                                        class='py-1'
                                        @click='config.cron = "cron(0/5 8-17 ? * MON-FRI *)"'
                                    >
                                        cron(0/5 8-17 ? * MON-FRI *)
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <input
                        v-model='config.cron'
                        :disabled='disabled'
                        :class='{
                            "is-invalid": errors.cron
                        }'
                        class='form-control'
                        placeholder='Cron Expression'
                    >
                    <div
                        v-if='errors.cron'
                        class='invalid-feedback'
                        v-text='errors.cron'
                    />
                    <label
                        v-if='config.cron'
                        v-text='cronstr(config.cron)'
                    />
                </div>
                <input :disabled='disabled' v-model='config.task' :class='{
                    "is-invalid": errors.task
                }' class="form-control" placeholder='Schedule Task'/>
                <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
            </div>
            <div class="col-md-4">
                <TablerEnum v-model='config.priority' label='Alarm Urgency' :disabled='disabled' class='w-100' :options='["off", "high", "low"]' />
            </div>
            <div class="col-md-4">
                <TablerInput v-model='config.stale' label='Stale Value (ms)' :disabled='disabled' type='number' min='1' step='1'/>
                <label v-if='config.stale' v-text='humanstr'/>
            </div>
            <div class="col-md-4">
                <TablerInput v-model='config.memory' label='Memory (Mb)' :disabled='disabled' type='number' min='1' step='1'/>
            </div>
            <div class="col-md-4">
                <TablerInput v-model='config.timeout' label='Timeout (s)' :disabled='disabled' type='number' min='1' step='1'/>
            </div>
            <div class="col-md-12">
                <div class='row'>
                    <div class='col-12'>
                        <label>Optional Data Sync</label>
                    </div>
                    <div class='col-12 d-flex align-items-center my-1'>
                        <IconDatabase size='32'/>
                        <DataSelect
                            :disabled='disabled'
                            :connection='layer.connection'
                            v-model='config.data'
                        />
                    </div>
                </div>
                <div
                    v-if='!disabled'
                    class='col-12 d-flex'
                >
                    <button
                        class='btn'
                        @click='reload'
                    >
                        Cancel
                    </button>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='saveLayer'
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <TaskModal
            v-if='taskmodal'
            :task='config.task'
            @close='taskmodal = false'
            @task='taskmodal = false; config.task = $event'
        />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import DataSelect from '../util/DataSelect.vue';
import cronstrue from 'cronstrue';
import TaskModal from './utils/TaskModal.vue';
import {
    TablerInput,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconSettings,
    IconBuildingBroadcastTower,
    IconDatabase,
} from '@tabler/icons-vue'

export default {
    name: 'LayerConfig',
    props: {
        layer: {
            type: Object,
            required: true
        },
        errors: {
            type: Object,
            default: function () {
                return {}
            }
        },
    },
    data: function() {
        return {
            disabled: true,
            taskmodal: false,
            newTaskVersion: false,
            loading: {
                init: true,
                version: false,
                save: false
            },
            config: {
                connection: null,
                priority: 'off',
                data: null,
                task: '',
                timeout: 60,
                memory: 512,
                cron: '0/15 * * * ? *',
                stale: 60 * 1000,
            }
        };
    },
    computed: {
        humanstr: function() {
            if (!this.config.stale) return '';
            var date = new Date(this.config.stale);
            var str = [];
            if (date.getUTCDate()-1 !== 0) str.push(date.getUTCDate()-1 + " days");
            if (date.getUTCHours() !== 0 ) str.push(date.getUTCHours() + " hrs");
            if (date.getUTCMinutes() !== 0) str.push(date.getUTCMinutes() + " mins");
            if (date.getUTCSeconds() !== 0) str.push(date.getUTCSeconds() + " secs");
            if (date.getUTCMilliseconds() !== 0) str.push(date.getUTCMilliseconds() + " ms");
            return str.join(', ');
        }
    },
    watch: {
        config: {
            deep: true,
            handler: function() {
                if (this.destination === 'connection') {
                    this.config.data = undefined;
                }
            }
        }
    },
    mounted: function() {
        this.reload();
        this.loading.init = false;
    },
    methods: {
        reload: function() {
            this.config.connection = this.layer.connection;
            this.config.data = this.layer.data;
            this.config.task = this.layer.task;
            this.config.timeout = this.layer.timeout;
            this.config.memory = this.layer.memory;
            this.config.cron = this.layer.cron;
            this.config.stale = this.layer.stale;
            this.config.priority = this.layer.priority;

            this.disabled = true;
        },
        saveLayer: async function() {
            this.loading.save = true;

            const layer = await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`, {
                method: 'PATCH',
                body: this.config
            });

            this.disabled = true;
            this.loading.save = false;

            this.$emit('layer', layer);
            this.$emit('stack');
        },
        updateTask: function() {
            this.config.task = this.config.task.replace(/-v[0-9]+\.[0-9]+\.[0-9]+$/, `-v${this.newTaskVersion}`);
            this.newTaskVersion = null;
        },
        cronstr: function(cron) {
            if (!cron) return;

            if (cron.includes('cron(')) {
                return cronstrue.toString(cron.replace('cron(', '').replace(')', ''));
            } else {
                const rate = cron.replace('rate(', '').replace(')', '');
                return `Once every ${rate}`;
            }
        },
        latestVersion: async function() {
            this.loading.version = true;
            const match = this.config.task.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/)
            if (!match) return;
            const task = match[1];
            const version = match[2];

            const list = await std(`/api/task/${task}`);

            if (list.versions.indexOf(version) !== 0) {
                this.newTaskVersion = list.versions[0];
            }
            this.loading.version = false;
        }
    },
    components: {
        TablerLoading,
        IconRefresh,
        IconSettings,
        DataSelect,
        IconBuildingBroadcastTower,
        IconDatabase,
        TaskModal,
        TablerInput,
        TablerEnum,
    }
}
</script>

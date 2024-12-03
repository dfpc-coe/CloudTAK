<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Config
            </h3>
            <div class='ms-auto btn-list'>
                <IconSettings
                    v-if='disabled'
                    :size='32'
                    :stroke='1'
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
                <div class='col-md-6'>
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
                                        :size='16'
                                        :stroke='1'
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
                <div class='col-md-6'>
                    <div class='d-flex'>
                        <label class='form-label'>Schedule Task</label>
                        <div class='ms-auto'>
                            <div class='btn-list'>
                                <div>
                                    <IconRefresh
                                        v-if='!newTaskVersion && !loading.version'
                                        v-tooltip='"Check for new version"'
                                        :size='16'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click='latestVersion'
                                    />
                                    <div
                                        v-else-if='loading.version'
                                        class='d-flex justify-content-center'
                                    >
                                        <div
                                            class='spinner-border'
                                            role='status'
                                        />
                                    </div>
                                    <span v-else>
                                        New Task Version
                                        <span
                                            v-if='disabled'
                                            v-text='newTaskVersion'
                                        />
                                        <span
                                            v-else
                                            class='cursor-pointer text-blue'
                                            @click='updateTask'
                                            v-text='newTaskVersion'
                                        />
                                    </span>
                                </div>
                                <div v-if='!disabled'>
                                    <IconSettings
                                        :size='16'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click='taskmodal = true'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <input
                        v-model='config.task'
                        :disabled='disabled'
                        :class='{
                            "is-invalid": errors.task
                        }'
                        class='form-control'
                        placeholder='Schedule Task'
                    >
                    <div
                        v-if='errors.task'
                        class='invalid-feedback'
                        v-text='errors.task'
                    />
                </div>
                <div class='col-md-12'>
                    <TablerToggle
                        v-model='config.webhook'
                        label='Enable Webhooks'
                    />

                    <CopyField
                        v-if='config.uuid'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='config.stale'
                        label='Stale Value (seconds)'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                    <label
                        v-if='config.stale'
                        v-text='humanstr'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='config.memory'
                        label='Memory (Mb)'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='config.timeout'
                        label='Timeout (s)'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                </div>
                <div class='col-md-12'>
                    <div class='row'>
                        <div class='col-12'>
                            <label>Optional Data Sync</label>
                        </div>
                        <div class='col-12 d-flex align-items-center my-1'>
                            <IconDatabase
                                :size='32'
                                :stroke='1'
                            />
                            <DataSelect
                                v-model='config.data'
                                :disabled='disabled'
                                :connection='layer.connection'
                            />
                        </div>
                    </div>
                </div>

                <div class='col-md-12'>
                    <TablerEnum
                        v-model='config.priority'
                        label='Alarm Urgency'
                        :disabled='disabled'
                        class='w-100'
                        :options='["off", "high", "low"]'
                    />
                </div>

                <label
                    v-if='config.priority !== "off"'
                    class='subheader mt-3 cursor-pointer'
                    @click='advanced = !advanced'
                >
                    <IconSquareChevronRight
                        v-if='!advanced'
                        :size='32'
                        :stroke='1'
                    />
                    <IconChevronDown
                        v-else
                        :size='32'
                        :stroke='1'
                    />
                    Advanced Alarm Options
                </label>

                <div
                    v-if='advanced && config.priority !== "off"'
                    class='border rounded col-12 mt-0'
                >
                    <div class='row py-2'>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_period'
                                label='Alarm Period (s)'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_evals'
                                label='Alarm Evals'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_points'
                                label='Alarm Points to Alarm'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_threshold'
                                label='Alarm Threshold'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                    </div>
                </div>

                <div
                    v-if='!disabled'
                    class='col-12 pt-3 d-flex'
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
    IconSquareChevronRight,
    IconChevronDown,
    IconRefresh,
    IconSettings,
    IconDatabase,
} from '@tabler/icons-vue'

export default {
    name: 'LayerConfig',
    components: {
        TablerLoading,
        IconSquareChevronRight,
        IconChevronDown,
        IconRefresh,
        IconSettings,
        DataSelect,
        IconDatabase,
        TaskModal,
        TablerInput,
        TablerEnum,
    },
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
    emits: [
        'layer',
        'stack'
    ],
    data: function() {
        return {
            disabled: true,
            taskmodal: false,
            newTaskVersion: false,
            advanced: false,
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
                alarm_period: '30',
                alarm_evals: '5',
                alarm_points: '4',
                alarm_threshold: '0'
            }
        };
    },
    computed: {
        humanstr: function() {
            if (!this.config.stale) return '';
            var date = new Date(this.config.stale * 1000);
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
            this.config.alarm_period = this.layer.alarm_period;
            this.config.alarm_evals = this.layer.alarm_evals;
            this.config.alarm_points = this.layer.alarm_points;
            this.config.alarm_threshold = this.layer.alarm_threshold;

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

            const list = await std(`/api/task/raw/${task}`);

            if (list.versions.indexOf(version) !== 0) {
                this.newTaskVersion = list.versions[0];
            }
            this.loading.version = false;
        }
    }
}
</script>

<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>Layer Config</h3>
        <div class='ms-auto btn-list'>
            <IconSettings v-if='disabled' @click='disabled = false' class='cursor-pointer'/>
        </div>
    </div>

    <TablerLoading v-if='loading.save' desc='Saving Config'/>
    <TablerLoading v-else-if='loading.init' desc='Loading Config'/>
    <div v-else class='card-body'>
        <div class='row g-4'>
            <div class="col-md-4">
                <div class='d-flex'>
                    <label class='form-label'>Cron Expression</label>
                    <div v-if='!disabled' class='ms-auto'>
                        <div class='dropdown'>
                            <div class="dropdown-toggle" type="button" id="dropdownCron" data-bs-toggle="dropdown" aria-expanded="false">
                                <IconSettings width='16' height='16' class='cursor-pointer dropdown-toggle'/>
                            </div>
                            <ul class="dropdown-menu px-1 py-1" aria-labelledby="dropdownCron">
                                <li class='py-1' @click='config.cron = "rate(1 minute)"'>rate(1 minute)</li>
                                <li class='py-1' @click='config.cron = "rate(5 minutes)"'>rate(5 minutes)</li>
                                <li class='py-1' @click='config.cron = "cron(15 10 * * ? *)"'>cron(15 10 * * ? *)</li>
                                <li class='py-1' @click='config.cron = "cron(0/5 8-17 ? * MON-FRI *)"'>cron(0/5 8-17 ? * MON-FRI *)</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <input :disabled='disabled' v-model='config.cron' :class='{
                    "is-invalid": errors.cron
                }' class="form-control" placeholder='Cron Expression'/>
                <div v-if='errors.cron' v-text='errors.cron' class="invalid-feedback"></div>
                <label v-if='config.cron' v-text='cronstr(config.cron)'/>
            </div>
            <div class="col-md-4">
                <div class='d-flex'>
                    <label class='form-label'>Schedule Task</label>
                    <div class='ms-auto'>
                        <div class='btn-list'>
                            <div>
                                <IconRefresh
                                    v-if='!newTaskVersion && !loading.version'
                                    @click='latestVersion'
                                    v-tooltip='"Check for new version"'
                                    width='16' height='16'
                                    class='cursor-pointer'
                                />
                                <div v-else-if='loading.version' class='d-flex justify-content-center'>
                                    <div class="spinner-border" role="status"></div>
                                </div>
                                <span v-else>
                                    New Task Version
                                    <span v-if='disabled' v-text='newTaskVersion'/>
                                    <span v-else @click='updateTask' class='cursor-pointer text-blue' v-text='newTaskVersion'/>
                                </span>
                            </div>
                            <div v-if='!disabled'>
                                <IconSettings @click='taskmodal = true' width='16' height='16' class='cursor-pointer'/>
                            </div>
                        </div>
                    </div>
                </div>
                <input :disabled='disabled' v-model='config.task' :class='{
                    "is-invalid": errors.task
                }' class="form-control" placeholder='Schedule Task'/>
                <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
            </div>
            <div class="col-md-4">
                <TablerEnum v-model='config.priority' label='Priority Level' :disabled='disabled' class='w-100' :options='["off", "high", "low"]' />
            </div>
            <div class="col-md-4">
                <TablerInput v-model='config.stale' label='Stale Value (ms)' :disabled='disabled' type='number' min='1' step='1'/>
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
                        <label>Data Destination</label>
                    </div>
                    <div class='col-12 d-flex align-items-center'>
                        <div class='btn-group' role="group">
                            <input :disabled='disabled' v-model='destination' value='connection' type="radio" class="btn-check" name="connection-toolbar" id="connection-toolbar-connection" autocomplete="off">
                            <label for="connection-toolbar-connection" class="btn btn-icon"><IconBuildingBroadcastTower/></label>

                            <input :disabled='disabled' v-model='destination' value='data' type="radio" class="btn-check" name="connection-toolbar" id="connection-toolbar-data" autocomplete="off">
                            <label for="connection-toolbar-data" class="btn btn-icon"><IconDatabase/></label>
                        </div>
                        <ConnectionSelect
                            v-if='destination === "connection"'
                            class='mx-2'
                            :disabled='disabled'
                            v-model='config.connection'
                        />
                        <DataSelect
                            v-else
                            class='mx-2'
                            :disabled='disabled'
                            v-model='config.data'
                        />
                    </div>
                </div>
            </div>
            <div v-if='!disabled' class="col-12 d-flex">
                <button @click='reload' class='btn'>Cancel</button>
                <div class='ms-auto'>
                    <button @click='saveLayer' class='btn btn-primary'>Save</button>
                </div>
            </div>
        </div>
    </div>

    <TaskModal v-if='taskmodal' :task='config.task' @close='taskmodal = false' @task='taskmodal = false; config.task = $event'/>
</div>
</template>

<script>
import ConnectionSelect from '../util/ConnectionSelect.vue';
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
            destination: 'connection',
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
    watch: {
        config: {
            deep: true,
            handler: function() {
                if (this.destination === 'connection') {
                    this.config.data = undefined;
                } else if (this.destination === 'data') {
                    this.config.connection = undefined;
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

            if (this.layer.connection) this.destination = 'connection';
            else this.destination = 'data';

            this.disabled = true;
        },
        saveLayer: async function() {
            this.loading.save = true;

            const layer = await window.std(`/api/layer/${this.$route.params.layerid}`, {
                method: 'PATCH',
                body: this.config
            });

            this.disabled = true;
            this.loading.save = false;

            this.$emit('layer', layer);
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

            const list = await window.std(`/api/task/${task}`);

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
        ConnectionSelect,
        IconBuildingBroadcastTower,
        IconDatabase,
        TaskModal,
        TablerInput,
        TablerEnum,
    }
}
</script>

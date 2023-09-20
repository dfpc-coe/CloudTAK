<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>Layer Config</h3>
        <div class='ms-auto btn-list'>
            <RefreshIcon class='cursor-pointer'/>
            <SettingsIcon v-if='disabled' @click='disabled = false' class='cursor-pointer'/>
        </div>
    </div>

    <div class='card-body'>
        <div class='row g-4'>
            <div class="col-md-6">
                <div class='d-flex'>
                    <label class='form-label'>Cron Expression</label>
                    <div v-if='!disabled' class='ms-auto'>
                        <div class='dropdown'>
                            <div class="dropdown-toggle" type="button" id="dropdownCron" data-bs-toggle="dropdown" aria-expanded="false">
                                <SettingsIcon width='16' height='16' class='cursor-pointer dropdown-toggle'/>
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
            <div class="col-md-6">
                <div class='d-flex'>
                    <label class='form-label'>Schedule Task</label>
                    <div class='ms-auto'>
                        <div class='btn-list'>
                            <div>
                                <RefreshIcon
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
                                <SettingsIcon @click='taskmodal = true' width='16' height='16' class='cursor-pointer'/>
                            </div>
                        </div>
                    </div>
                </div>
                <input :disabled='disabled' v-model='config.task' :class='{
                    "is-invalid": errors.task
                }' class="form-control" placeholder='Schedule Task'/>
                <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
            </div>
            <div class="col-md-6">
                <div class='row'>
                    <label>Layer Data Destination</label>
                    <div class='col-2'>
                        <div class="btn-group" role="group">
                          <input :disabled='disabled' v-model='destination' value='connection' type="radio" class="btn-check" name="connection-toolbar" id="connection-toolbar-connection" autocomplete="off">
                          <label for="connection-toolbar-connection" class="btn btn-icon"><BuildingBroadcastTowerIcon/></label>

                          <input :disabled='disabled' v-model='destination' value='data' type="radio" class="btn-check" name="connection-toolbar" id="connection-toolbar-data" autocomplete="off">
                          <label for="connection-toolbar-data" class="btn btn-icon"><DatabaseIcon/></label>
                        </div>
                    </div>
                    <div v-if='destination === "connection"' class='col-10'>
                        <ConnectionSelect
                            :disabled='disabled'
                            v-model='config.connection'
                        />
                    </div>
                    <div v-else class='col-10'>
                        <DataSelect
                            :disabled='disabled'
                            v-model='config.data'
                        />
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <label>Stale Value (ms)</label>
                <TablerInput v-model='config.stale' :disabled='disabled' type='number' min='1' step='1'/>
            </div>
            <div class="col-md-6">
                <label>Memory (Mb)</label>
                <TablerInput v-model='config.memory' :disabled='disabled' type='number' min='1' step='1'/>
            </div>
            <div class="col-md-6">
                <label>Timeout (s)</label>
                <TablerInput v-model='config.timeout' :disabled='disabled' type='number' min='1' step='1'/>
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
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    RefreshIcon,
    SettingsIcon,
    BuildingBroadcastTowerIcon,
    DatabaseIcon,
} from 'vue-tabler-icons'

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
                version: false
            },
            destination: 'connection',
            config: {
                connection: null,
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

            if (this.layer.connection) this.destination = 'connection';
            else this.destination = 'data';

            this.disabled = true;
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
        RefreshIcon,
        SettingsIcon,
        DataSelect,
        ConnectionSelect,
        BuildingBroadcastTowerIcon,
        DatabaseIcon,
        TaskModal,
        TablerInput
    }
}
</script>

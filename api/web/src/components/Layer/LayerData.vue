<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Layer Data</h3>
    </div>

    <div class='card-body'>
        <TablerLoading v-if='loading.main'/>
        <div v-else class='row'>
            <div class="col-md-6 mb-3">
                <div class='d-flex'>
                    <label class='form-label'>Cron Expression</label>
                    <div v-if='!disabled' class='ms-auto'>
                        <div class='dropdown'>
                            <div class="dropdown-toggle" type="button" id="dropdownCron" data-bs-toggle="dropdown" aria-expanded="false">
                                <SettingsIcon width='16' height='16' class='cursor-pointer dropdown-toggle'/>
                            </div>
                            <ul class="dropdown-menu px-1 py-1" aria-labelledby="dropdownCron">
                                <li class='py-1' @click='layer.cron = "rate(1 minute)"'>rate(1 minute)</li>
                                <li class='py-1' @click='layer.cron = "rate(5 minutes)"'>rate(5 minutes)</li>
                                <li class='py-1' @click='layer.cron = "cron(15 10 * * ? *)"'>cron(15 10 * * ? *)</li>
                                <li class='py-1' @click='layer.cron = "cron(0/5 8-17 ? * MON-FRI *)"'>cron(0/5 8-17 ? * MON-FRI *)</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <input :disabled='disabled' v-model='layer.cron' :class='{
                    "is-invalid": errors.cron
                }' class="form-control" placeholder='Cron Expression'/>
                <div v-if='errors.cron' v-text='errors.cron' class="invalid-feedback"></div>
                <label v-if='layer.cron' v-text='cronstr(layer.cron)'/>
            </div>
            <div class="col-md-6 mb-3">
                <div class='d-flex'>
                    <label class='form-label'>Schedule Task</label>
                    <div class='ms-auto'>
                        <div class='btn-list'>
                            <div>
                                <RefreshIcon v-if='!newTaskVersion && !loading.version' @click='latestVersion' width='16' height='16' class='cursor-pointer'/>
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
                <input :disabled='disabled' v-model='layer.task' :class='{
                    "is-invalid": errors.task
                }' class="form-control" placeholder='Schedule Task'/>
                <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
            </div>
            <div class="col-md-6">
                <ConnectionSelect
                    :disabled='disabled'
                    v-model='layer.connection'

                />
            </div>
            <div class="col-md-6">
                <label>Stale Value (ms)</label>
                <TablerInput v-model='layer.stale' :disabled='disabled' type='number' min='1' step='1'/>
            </div>
            <div class="col-md-6">
                <label>Memory (Mb)</label>
                <TablerInput v-model='layer.memory' :disabled='disabled' type='number' min='1' step='1'/>
            </div>
            <div class="col-md-6">
                <label>Timeout (s)</label>
                <TablerInput v-model='layer.timeout' :disabled='disabled' type='number' min='1' step='1'/>
            </div>

            <LayerEnvironment v-if='$route.params.layerid' v-model='layer.environment' :disabled='disabled'/>
        </div>
    </div>

    <TaskModal v-if='taskmodal' :task='layer.task' @close='taskmodal = false' @task='taskmodal = false; layer.task = $event'/>
</div>
</template>

<script>
import LayerEnvironment from './LayerEnvironent.vue';
import ConnectionSelect from '../util/ConnectionSelect.vue';
import cronstrue from 'cronstrue';
import TaskModal from './TaskModal.vue';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    RefreshIcon,
    SettingsIcon
} from 'vue-tabler-icons'

export default {
    name: 'LayerData',
    props: {
        modelValue: {
            type: Object,
            required: true
        },
        errors: {
            type: Object,
            default: function () {
                return {}
            }
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            taskmodal: false,
            newTaskVersion: false,
            loading: {
                main: false,
                version: false
            },
            layer: {
                connection: null,
                task: '',
                timeout: 60,
                memory: 512,
                cron: '0/15 * * * ? *',
                stale: 60 * 1000,
                environment: {}
            }
        };
    },
    watch: {
        modelValue: {
            deep: true,
            handler: function() {
                this.layer = Object.assign(this.layer, this.modelValue);
            }
        },
        layer: {
            deep: true,
            handler: function() {
                const layer = Object.assign(this.modelValue, this.layer);
                this.$emit('update:modelValue', layer);
            }
        }
    },
    mounted: function() {
        this.layer = Object.assign(this.layer, this.modelValue);
        this.$nextTick(() => {
            this.loading.main = false;
        });
    },
    methods: {
        updateTask: function() {
            this.layer.task = this.layer.task.replace(/-v[0-9]+\.[0-9]+\.[0-9]+$/, `-v${this.newTaskVersion}`);
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
            const match = this.layer.task.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/)
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
        LayerEnvironment,
        TablerLoading,
        RefreshIcon,
        SettingsIcon,
        ConnectionSelect,
        TaskModal,
        TablerInput
    }
}
</script>

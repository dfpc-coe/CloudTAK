<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Layer Data</h3>
    </div>

    <div class='card-body'>
        <TablerLoading v-if='loading.main'/>
        <div v-else class='row'>
            <div v-if='!$route.params.layerid' class="d-flex justify-content-center mb-4">
                <div class="btn-list">
                    <div class="btn-group" role="group">
                        <input v-model='layerdata.mode' type="radio" class="btn-check" name="task-type-toolbar" value='live'>
                        <label @click='layerdata.mode="live"' class="btn btn-icon px-3">
                            <ClockIcon/> Scheduled
                        </label>
                        <input v-model='layerdata.mode' type="radio" class="btn-check" name="task-type-toolbar" value='file'>
                        <label @click='layerdata.mode="file"' class="btn btn-icon px-3">
                            <FileUploadIcon/> Upload
                        </label>
                    </div>
                </div>
            </div>

            <template v-if='layerdata.mode === "live"'>
                <div class="col-md-6 mb-3">
                    <div class='d-flex'>
                        <label class='form-label'>Cron Expression</label>
                        <div v-if='!disabled' class='ms-auto'>
                            <div class='dropdown'>
                                <div class="dropdown-toggle" type="button" id="dropdownCron" data-bs-toggle="dropdown" aria-expanded="false">
                                    <SettingsIcon width='16' height='16' class='cursor-pointer dropdown-toggle'/>
                                </div>
                                <ul class="dropdown-menu px-1 py-1" aria-labelledby="dropdownCron">
                                    <li class='py-1' @click='layerdata.cron = "rate(1 minute)"'>rate(1 minute)</li>
                                    <li class='py-1' @click='layerdata.cron = "rate(5 minutes)"'>rate(5 minutes)</li>
                                    <li class='py-1' @click='layerdata.cron = "cron(15 10 * * ? *)"'>cron(15 10 * * ? *)</li>
                                    <li class='py-1' @click='layerdata.cron = "cron(0/5 8-17 ? * MON-FRI *)"'>cron(0/5 8-17 ? * MON-FRI *)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <input :disabled='disabled' v-model='layerdata.cron' :class='{
                        "is-invalid": errors.cron
                    }' class="form-control" placeholder='Cron Expression'/>
                    <div v-if='errors.cron' v-text='errors.cron' class="invalid-feedback"></div>
                    <label v-if='layerdata.cron' v-text='cronstr(layerdata.cron)'/>
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
                    <input :disabled='disabled' v-model='layerdata.task' :class='{
                        "is-invalid": errors.task
                    }' class="form-control" placeholder='Schedule Task'/>
                    <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
                </div>
                <div class="col-md-6">
                    <ConnectionSelect
                        :disabled='disabled'
                        v-model='layerdata.connection'

                    />
                </div>
                <div class="col-md-6">
                    <label>Stale Value (ms)</label>
                    <TablerInput v-model='layerdata.stale' :disabled='disabled' type='number' min='1' step='1'/>
                </div>

                <LayerEnvironment v-model='layerdata.environment' :disabled='disabled'/>
            </template>
            <template v-else-if='layerdata.mode === "file"'>
                <template v-if='!layerdata.raw_asset_id'>
                    <UploadInline
                        @asset='layerdata.raw_asset_id = $event.id'
                    />
                </template>
                <template v-else>
                    <Asset :asset_id='layerdata.raw_asset_id'/>
                    <Asset v-if='layerdata.std_asset_id' :asset_id='layerdata.std_asset_id'/>
                </template>
            </template>
            <template v-else>
                <div class='d-flex justify-content-center mb-3'>
                    Select a Layer Type
                </div>
            </template>
        </div>
    </div>

    <TaskModal v-if='taskmodal' :task='layerdata.task' @close='taskmodal = false' @task='taskmodal = false; layerdata.task = $event'/>
</div>
</template>

<script>
import UploadInline from '../util/UploadInline.vue';
import LayerEnvironment from './LayerEnvironent.vue';
import Asset from '../util/Asset.vue';
import ConnectionSelect from '../util/ConnectionSelect.vue';
import cronstrue from 'cronstrue';
import TaskModal from './TaskModal.vue';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    ClockIcon,
    RefreshIcon,
    FileUploadIcon,
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
            layerdata: {
                mode: 'live',
                connection: null,
                raw_asset_id: null,
                std_asset_id: null,
                task: '',
                cron: '0/15 * * * ? *',
                stale: 60 * 1000,
                environment: {}
            }
        };
    },
    watch: {
        layerdata: {
            deep: true,
            handler: function() {
                if (this.layerdata.mode === 'live') {
                    this.$emit('update:modelValue', {
                        mode: this.layerdata.mode,
                        task: this.layerdata.task,
                        cron: this.layerdata.cron,
                        stale: parseInt(this.layerdata.stale),
                        connection: this.layerdata.connection,
                        environment: this.layerdata.environment
                    });
                } else if (this.layerdata.mode === 'file') {
                    this.$emit('update:modelValue', {
                        mode: this.layerdata.mode,
                        raw_asset_id: this.layerdata.raw_asset_id
                    });
                }
            }
        }
    },
    mounted: function() {
        this.layerdata = Object.assign(this.layerdata, this.modelValue);
        this.$nextTick(() => {
            this.loading.main = false;
        });
    },
    methods: {
        updateTask: function() {
            this.layerdata.task = this.layerdata.task.replace(/-v[0-9]+\.[0-9]+\.[0-9]+$/, `-v${this.newTaskVersion}`);
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
            const match = this.layerdata.task.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/)
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
        Asset,
        ClockIcon,
        RefreshIcon,
        FileUploadIcon,
        SettingsIcon,
        ConnectionSelect,
        UploadInline,
        TaskModal,
        TablerInput
    }
}
</script>

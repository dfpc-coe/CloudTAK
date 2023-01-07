<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Layer Data</h3>
    </div>

    <div class='card-body'>
        <div class='row'>
            <div v-if='!$route.params.layerid' class="d-flex justify-content-center mb-4">
                <div class="btn-list">
                    <div class="btn-group" role="group">
                        <input v-model='layerdata.mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='live'>
                        <label @click='layerdata.mode="live"' class="btn btn-icon px-3">
                            <ClockIcon/> Scheduled
                        </label>
                        <input v-model='layerdata.mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='file'>
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
                        <div v-if='!disabled' class='ms-auto'>
                            <SettingsIcon @click='taskmodal = true' width='16' height='16' class='cursor-pointer'/>
                        </div>
                    </div>
                    <input :disabled='disabled' v-model='layerdata.task' :class='{
                        "is-invalid": errors.task
                    }' class="form-control" placeholder='Schedule Task'/>
                    <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
                </div>
                <div class="col-md-12">
                    <ConnectionSelect
                        :disabled='disabled'
                        v-model='layerdata.connection'

                    />
                </div>
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

    <TaskModal v-if='taskmodal' @close='taskmodal = false' @task='taskmodal = false; layerdata.task = $event'/>
</div>
</template>

<script>
import UploadInline from '../util/UploadInline.vue';
import Asset from '../util/Asset.vue';
import ConnectionSelect from '../util/ConnectionSelect.vue';
import cronstrue from 'cronstrue';
import TaskModal from './TaskModal.vue';
import {
    ClockIcon,
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
            layerdata: {
                mode: 'live',
                connection: null,
                raw_asset_id: null,
                std_asset_id: null,
                task: '',
                cron: '0/15 * * * ? *'
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
                        connection: this.layerdata.connection
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
        this.layerdata = Object.assign(this.modelValue);
    },
    methods: {
        cronstr: function(cron) {
            if (!cron) return;

            if (cron.includes('cron(')) {
                return cronstrue.toString(cron.replace('cron(', '').replace(')', ''));
            } else {
                const rate = cron.replace('rate(', '').replace(')', '');
                return `Once every ${rate}`;
            }
        },
    },
    components: {
        Asset,
        ClockIcon,
        FileUploadIcon,
        SettingsIcon,
        ConnectionSelect,
        UploadInline,
        TaskModal
    }
}
</script>

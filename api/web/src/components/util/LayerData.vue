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
                    <TablerInput :disabled='disabled' label='Cron Schedule' v-model='layerdata.cron' :error='errors.cron'/>
                </div>
                <div class="col-md-6 mb-3">
                    <TablerInput :disabled='disabled' label='Schedule Task' v-model='layerdata.task' :error='errors.task'/>
                </div>
                <div class="col-md-12">
                    <ConnectionSelect
                        :disabled='disabled'
                        v-model='layerdata.connection'

                    />
                </div>
            </template>
            <template v-else-if='layerdata.mode === "file"'>
                <template v-if='!layerdata.asset_id'>
                    <UploadInline
                        @asset='layerdata.asset_id = $event.id'
                    />
                </template>
                <template v-else>
                    <Asset :asset_id='layerdata.asset_id'/>
                </template>
            </template>
            <template v-else>
                <div class='d-flex justify-content-center mb-3'>
                    Select a Layer Type
                </div>
            </template>
        </div>
    </div>
</div>
</template>

<script>
import UploadInline from './UploadInline.vue';
import Asset from './Asset.vue';
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import ConnectionSelect from './ConnectionSelect.vue';

import {
    ClockIcon,
    FileUploadIcon
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
            layerdata: {
                mode: 'live',
                connection: null,
                asset_id: null,
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
                        asset_id: this.layerdata.asset_id
                    });
                }
            }
        }
    },
    mounted: function() {
        this.layerdata = Object.assign(this.modelValue);
    },
    components: {
        Asset,
        TablerInput,
        ClockIcon,
        FileUploadIcon,
        ConnectionSelect,
        UploadInline
    }
}
</script>

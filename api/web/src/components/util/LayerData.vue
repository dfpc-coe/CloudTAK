<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Layer Data</h3>
    </div>

    <div class='card-body'>
        <div class='row'>
            <div class="d-flex justify-content-center mb-4">
                <div class="btn-list">
                    <div class="btn-group" role="group">
                        <input v-model='layer.mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='scheduled'>
                        <label @click='layer.mode="scheduled"' class="btn btn-icon px-3">
                            <ClockIcon/> Scheduled
                        </label>
                        <input v-model='layer.mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='upload'>
                        <label @click='layer.mode="upload"' class="btn btn-icon px-3">
                            <FileUploadIcon/> Upload
                        </label>
                    </div>
                </div>
            </div>

            <template v-if='layer.mode === "scheduled"'>
                <div class="col-md-6 mb-3">
                    <TablerInput label='Cron Schedule' v-model='layer.cron' :error='errors.cron'/>
                </div>
                <div class="col-md-6 mb-3">
                    <TablerInput label='Schedule Task' v-model='layer.task' :error='errors.task'/>
                </div>
                <div class="col-md-12">
                    <ConnectionSelect
                        @err='$emit("err", $event)'
                        :connection='layer.connection'

                    />
                </div>
            </template>
            <template v-if='layer.mode === "upload"'>
                <template v-if='!layer.asset_id'>
                    <UploadInline
                        @err='$emit("err", $event)'
                        @asset='layer.asset_id = $event.id'
                    />
                </template>
                <template v-else>
                    LAYER
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
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import ConnectionSelect from './ConnectionSelect.vue';

import {
    ClockIcon,
    FileUploadIcon
} from 'vue-tabler-icons'

export default {
    name: 'LayerUtil',
    props: {
        modelValue: {
            type: Object,
            default: function() {
                return {};
            },
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            errors: {
                task: '',
                cron: ''
            },
            layer: {
                mode: 'scheduled',
                asset_id: '',
                task: '',
                cron: ''
            }
        };
    },
    watch: {
        layer: {
            deep: true,
            handler: function() {
                if (this.layer.mode === 'scheduled') {
                    this.$emit('update:modelValue', {
                        mode: this.layer.mode,
                        task: this.layer.task,
                        cron: this.layer.cron,
                    });
                } else if (this.layer.mode === 'upload') {
                    this.$emit('update:modelValue', {
                        mode: this.layer.mode,
                        asset_id: this.layer.asset_id
                    });
                }
            }
        }
    },
    mounted: function() {
        this.layer = Object.assign(this.modelValue);
    },
    components: {
        TablerInput,
        ClockIcon,
        FileUploadIcon,
        ConnectionSelect,
        UploadInline
    }
}
</script>

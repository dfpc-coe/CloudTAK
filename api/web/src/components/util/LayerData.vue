<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Layer Data</h3>

        <div class='ms-auto'>
            <div class='d-flex'>
                <span class='px-2'>Disable Layer</span>
                <label class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" checked="">
                </label>
            </div>
        </div>
    </div>

    <div class='card-body'>
        <div class='row'>
            <div class="d-flex justify-content-center mb-4">
                <div class="btn-list">
                    <div class="btn-group" role="group">
                        <input v-model='mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='scheduled'>
                        <label @click='mode="scheduled"' class="btn btn-icon px-3">
                            <ClockIcon/> Scheduled
                        </label>
                        <input v-model='mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='upload'>
                        <label @click='mode="upload"' class="btn btn-icon px-3">
                            <FileUploadIcon/> Upload
                        </label>
                    </div>
                </div>
            </div>

            <template v-if='mode === "scheduled"'>
                <div class="col-md-6">
                    <label class="row">
                        <span class="col">
                            <label class='form-label'>Scheduled</label>
                        </span>
                        <span class="col-auto">
                            <label class="form-check form-check-single form-switch">
                                <input v-model='layer.enabled' class="form-check-input" type="checkbox"/>
                            </label>
                        </span>
                    </label>
                    <input v-model='layer.cron' type="text" :class='{
                        "is-invalid": errors.cron
                    }' class="form-control" placeholder="CRON Schedule">
                    <div v-if='errors.cron' v-text='errors.cron' class="invalid-feedback"></div>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Layer Task</label>
                    <input v-model='layer.task' type="text" :class='{
                        "is-invalid": errors.task
                    }' class="form-control" placeholder="Layer Task">
                    <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
                </div>
                <div class="col-md-12">
                    <ConnectionSelect
                        @err='$emit("err", $event)'
                        :connection='layer.connection'

                    />
                </div>
            </template>
            <template v-else>
                <template v-if='!layer.asset_id'>
                    <UploadInline
                        @err='$emit("err", $event)'
                        @asset='asset = $event'
                    />
                </template>
                <template v-else>
                    LAYER
                </template>
            </template>
        </div>
    </div>
</div>
</template>

<script>
import UploadInline from './UploadInline.vue';
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
            mode: 'scheduled',
            asset: { },
            errors: {
                task: '',
                cron: ''
            },
            layer: {
                asset_id: '',
                task: '',
                cron: ''
            }
        };
    },
    watch: {
/*
        filters: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.filters);
            }
        }
*/
    },
    mounted: function() {
        //this.$emit('update:modelValue', this.filters);
    },
    components: {
        ClockIcon,
        FileUploadIcon,
        ConnectionSelect,
        UploadInline
    }
}
</script>

<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-header py-4">
            <span class='modal-title'>Create Field</span>
        </div>
        <div class="modal-body py-4">
            <TablerInput label='Field Name' v-model='field.name' class='py-1'/>
            <TablerEnum :key='+new Date()' label='Type' v-model='field.type' :options='[
                "string",
                "number",
                "integer",
                "object"
            ]' class='py-1'/>
            <TablerToggle label='Required' v-model='field.required' class='py-1'/>
            <button v-if='edit' @click='$emit("done", field)' class='btn btn-primary w-100 mt-4'>Update</button>
            <button v-else @click='$emit("done", field)' class='btn btn-primary w-100 mt-4'>Create</button>
        </div>
    </TablerModal>
</template>

<script>

import {
    TablerInput,
    TablerToggle,
    TablerEnum,
    TablerModal,
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerSchemaModal',
    props: {
        edit: {
            type: Object,
        }
    },
    data: function() {
        return {
            field: {
                name: '',
                type: 'string',
                required: true
            }
        }
    },
    mounted: function() {
        if (this.edit) this.field = Object.assign(this.field, JSON.parse(JSON.stringify(this.edit)));
    },
    updated: function() {
        if (this.edit) this.field = Object.assign(this.field, JSON.parse(JSON.stringify(this.edit)));
    },
    components: {
        TablerModal,
        TablerInput,
        TablerToggle,
        TablerEnum
    }
}
</script>

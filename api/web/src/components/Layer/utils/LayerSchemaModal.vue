<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-header">
            <span class='modal-title'>Create Field</span>
        </div>
        <div class="modal-body py-4">
            <TablerInput label='Field Name' :error='errors.name' v-model='field.name' class='py-1'/>
            <TablerEnum label='Type' v-model='field.type' :options='[
                "string",
                "number",
                "integer",
                "object"
            ]' class='py-1'/>
            <TablerToggle label='Required' v-model='field.required' class='py-1'/>
            <button v-if='edit' @click='done' class='btn btn-primary w-100 mt-4'>Update</button>
            <button v-else @click='done' class='btn btn-primary w-100 mt-4'>Create</button>
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
        },
        schema: {
            type: Array,
            required: true
        }
    },
    data: function() {
        return {
            errors: {
                name: ''
            },
            field: {
                name: '',
                type: 'string',
                required: true
            }
        }
    },
    mounted: function() {
        if (this.edit) {
            this.field = Object.assign(this.field, JSON.parse(JSON.stringify(this.edit)));
        }
    },
    methods: {
        done: function() {
            for (const field of ['name']) this.errors[field] = !this.field[field] ? 'Cannot be empty' : '';

            if ((this.edit && this.edit.name !== this.field.name) || !this.edit) {
                let dup = false
                for (const f of this.schema) if (f.name === this.field.name) dup = true;
                if (dup) this.errors.name = 'Duplicate Name';
            }

            for (const e in this.errors) if (this.errors[e]) return;

            this.$emit('done', this.field);
        }
    },
    components: {
        TablerModal,
        TablerInput,
        TablerToggle,
        TablerEnum
    }
}
</script>

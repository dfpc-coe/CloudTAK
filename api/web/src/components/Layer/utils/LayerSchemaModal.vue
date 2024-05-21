<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <span class='modal-title'>Create Field</span>
        </div>
        <div class='modal-body py-4'>
            <TablerInput
                v-model='field.name'
                label='Field Name'
                :error='errors.name'
                class='py-1'
            />
            <TablerEnum
                v-model='field.type'
                label='Type'
                :options='[
                    "string",
                    "number",
                    "integer",
                    "object"
                ]'
                class='py-1'
            />
            <TablerToggle
                v-model='field.required'
                label='Required'
                class='py-1'
            />
            <button
                v-if='edit'
                class='btn btn-primary w-100 mt-4'
                @click='done'
            >
                Update
            </button>
            <button
                v-else
                class='btn btn-primary w-100 mt-4'
                @click='done'
            >
                Create
            </button>
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
    components: {
        TablerModal,
        TablerInput,
        TablerToggle,
        TablerEnum
    },
    props: {
        edit: {
            type: Object,
        },
        schema: {
            type: Array,
            required: true
        }
    },
    emits: [
        'close',
        'done'
    ],
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
    }
}
</script>

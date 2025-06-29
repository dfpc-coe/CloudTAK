<template>
    <Mentionable
        :keys='keys'
        :items='schemalist'
    >
        <TablerInput
            v-model='template'
            :label='label'
            :disabled='disabled'
            :description='description'
            :rows='templateRows'
            :placeholder='placeholder'
        />

        <template #no-result>
            <div class='subheader mx-2 my-2 text-center'>
                No Results
            </div>
        </template>

        <template #item-{='{ item }'>
            <div
                class='subheader mx-2 my-2 text-center cursor-pointer'
                v-text='item.label'
            />
        </template>
    </Mentionable>
</template>

<script>
import { Mentionable } from 'vue-mention'
import {
    TablerInput,
} from '@tak-ps/vue-tabler';

export default {
    name: 'StyleTemplate',
    components: {
        TablerInput,
        Mentionable
    },
    props: {
        modelValue: {
            type: String,
            required: true
        },
        schema: {
            type: Object,
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        },
        label: {
            type: String,
        },
        placeholder: {
            type: String,
        },
        description: {
            type: String,
        },
        rows: {
            type: Number
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            keys: ["{"],
            template: this.modelValue
        }
    },
    computed: {
        templateRows: function() {
            if (this.rows) return this.rows;

            const rows = this.template.split('\n').length;
            if (rows < 2) return 2
            return rows;
        },
        schemalist: function() {
            return Object.keys(this.schema.properties).map((ele) => {
                return {
                    value: '{' + ele + '}}',
                    label: ele
                };
            });
        }
    },
    watch: {
        modelValue: function() {
            this.template = this.modelValue;
        },
        template: function() {
            this.$emit('update:modelValue', this.template);
        }
    }
}
</script>

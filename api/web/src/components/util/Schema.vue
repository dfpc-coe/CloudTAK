<template>
<div class='px-2 py-2'>
    <div :key='key' v-for='key in Object.keys(schema.properties)' class='py-2 floating-input'>
        <template v-if='schema.properties[key].enum'>
            <TablerEnum
                :label='key'
                :disabled='disabled'
                v-model='data[key]'
                :options='schema.properties[key].enum'
                :default='schema.properties[key].default'
            />
        </template>
        <template v-else-if='schema.properties[key].type === "string"'>
            <TablerInput :label='key' :disabled='disabled' v-model='data[key]'/>
        </template>
        <template v-else-if='schema.properties[key].type === "boolean"'>
            <TablerToggle :label='key' :disabled='disabled' v-model='data[key]'/>
        </template>
        <template v-else-if='schema.properties[key].type === "array"'>
            <div class='d-flex'>
                <label class='form-label' v-text='key'/>
                <div class='ms-auto'>
                    <IconPlus v-if='!disabled' @click='push(key)' size='32' class='cursor-pointer'/>
                </div>
            </div>

            <div :key='i' v-for='(arr, i) of data[key]' class='border rounded my-2 py-2 mx-2 px-2'>
                <div class='d-flex'>
                    <div class='mx-2 my-2'>Entry <span v-text='i + 1'/></div>
                    <div class='ms-auto mx-2 my-2'>
                        <IconTrash v-if='!disabled' @click='data[key].splice(i, 1)' size='32' class='cursor-pointer'/>
                    </div>
                </div>

                <GenericSchema :schema='schema.properties[key].items' :disabled='disabled' v-model='data[key][i]' />
            </div>
        </template>
        <template v-else>
            <div class='row'>
                <TablerInput :label='key' :rows='3' :disabled='disabled' v-model='data[key]'/>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerInput,
    TablerToggle,
    TablerEnum
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconTrash,
} from '@tabler/icons-vue'

export default {
    name: 'GenericSchema',
    props: {
        modelValue: {
            type: Object,
            required: true
        },
        schema: {
            type: Object,
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            data: {},
        };
    },
    watch: {
        data: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.data);
            }
        },
    },
    mounted: async function() {
        this.data = JSON.parse(JSON.stringify(this.modelValue));

        for (const key of Object.keys(this.schema.properties)) {
            if (this.schema.properties[key].display === 'table') {
                this.edit[key] = new Map();
            }
        }

        if (this.schema.type === 'object' && this.schema.properties) {
            for (const key in this.schema.properties) {
                if (!this.data[key] && this.schema.properties[key].type === 'array') {
                    this.data[key] = [];
                }
            }
        }
    },
    methods: {
        remove: function(key, arr, i) {
            this.edit[key].delete(arr);
            this.data[key].splice(i, 1)
        },
        push: function(key) {
            if (!this.schema.properties[key].items) this.data[key].push('');
            if (this.schema.properties[key].items.type === 'object') {
                this.data[key].push({});
            } else if (this.schema.properties[key].items.type === 'array') {
                this.data[key].push([]);
            } else if (this.schema.properties[key].items.type === 'boolean') {
                this.data[key].push(false);
            } else {
                this.data[key].push('');
            }
        }
    },
    components: {
        IconPlus,
        IconTrash,
        TablerInput,
        TablerToggle,
        TablerEnum
    }
}
</script>

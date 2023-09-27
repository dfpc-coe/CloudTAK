<template>
<Mentionable
  :keys="['{']"
  :items="schemalist"
  offset="6"
>
    <TablerInput
        :label='label'
        :disabled='disabled'
        :description='`Override and/or template the ${label} field of the CoT message. If you do not wish to override the CoT property, leave this field blank.`'
        v-model='template'
    />

    <template #no-result>
        <div class="subheader mx-2 my-2 text-center">No Results</div>
    </template>

      <template #item-{="{ item }">
        <div class="subheader mx-2 my-2 text-center cursor-pointer" v-text='item.label'></div>
      </template>
</Mentionable>
</template>

<script>
import { Mentionable } from 'vue-mention'
import {
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'StyleTemplate',
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
            default: 'Template'
        }
    },
    computed: {
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
    },
    data: function() {
        return {
            template: ''
        }
    },
    components: {
        TablerInput,
        Mentionable
    }
}
</script>

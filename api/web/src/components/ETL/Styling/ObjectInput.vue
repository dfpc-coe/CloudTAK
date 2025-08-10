<template>
    <div class='col-12 py-2'>
        <TablerInput
            v-model='current'
            :rows='32'
            :error='error'
        />
    </div>
</template>

<script>
import {
    TablerInput
} from '@tak-ps/vue-tabler'
import deepEqual from 'deep-equal';

export default {
    name: 'ObjectInput',
    components: {
        TablerInput
    },
    props: {
        modelValue: {
            type: Object,
            required: true
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            error: '',
            current: this.modelValue ? JSON.stringify(this.modelValue, null, 4) : ''
        }
    },
    watch: {
        modelValue: {
            deep: true,
            handler: function() {
                if (!deepEqual(this.modelValue, JSON.parse(this.current))) {
                    this.current = JSON.stringify(this.modelValue, null, 4)
                }
            }
        },
        current: function() {
            try {
                this.$emit('update:modelValue', JSON.parse(this.current));
                this.error = '';
            } catch (err) {
                this.error = `Invalid JSON: ${err.message}`;
            }
        }
    }
}
</script>

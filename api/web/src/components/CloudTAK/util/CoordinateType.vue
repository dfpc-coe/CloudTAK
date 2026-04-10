<template>
    <TablerPillGroup
        v-model='config.mode'
        :options='coordOptions'
        :rounded='false'
        :full-width='false'
        size='default'
        name='point-type'
        padding=''
    >
        <template #option='{ option }'>
            <span v-tooltip='option.label'>
                <IconPoint
                    v-if='option.value === "u-d-p"'
                    title='Point Icon'
                    :size='size'
                    stroke='1'
                />
                <img
                    v-else
                    :width='size'
                    :height='size'
                    :src='`/pngs/${option.value}.png`'
                >
            </span>
        </template>
    </TablerPillGroup>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    IconPoint
} from '@tabler/icons-vue';
import { TablerPillGroup } from '@tak-ps/vue-tabler';

const coordOptions = [
    { value: 'u-d-p', label: 'Custom Point' },
    { value: 'a-u-G', label: 'Unknown Point' },
    { value: 'a-f-G', label: 'Friendly Point' },
    { value: 'a-h-G', label: 'Hostile Point' },
    { value: 'a-n-G', label: 'Neutral Point' },
];

const props = defineProps({
    modelValue: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        default: 24
    }
});

const config = ref({
    mode: props.modelValue || 'u-d-p'
})

const emit = defineEmits([ 'update:modelValue' ])

watch(config.value, () => {
    emit('update:modelValue', config.value.mode);
})
</script>

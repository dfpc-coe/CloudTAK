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
            <span :title='option.label'>
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
                    :src='sidcIcon(option.value)'
                >
            </span>
        </template>
    </TablerPillGroup>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import ms from 'milsymbol';
import {
    IconPoint
} from '@tabler/icons-vue';
import { TablerPillGroup } from '@tak-ps/vue-tabler';
import { LegacyPointTypes, normalizePointType } from '../../../base/utils/point-type.ts';

// Points are created as 2525E Land Unit SIDCs where possible - u-d-p (Custom
// Point) has no 2525E equivalent and remains a traditional CoT type
const coordOptions = [
    { value: 'u-d-p', label: 'Custom Point' },
    { value: LegacyPointTypes['a-u-G'], label: 'Unknown Point' },
    { value: LegacyPointTypes['a-f-G'], label: 'Friendly Point' },
    { value: LegacyPointTypes['a-h-G'], label: 'Hostile Point' },
    { value: LegacyPointTypes['a-n-G'], label: 'Neutral Point' },
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
    mode: normalizePointType(props.modelValue)
})

const emit = defineEmits([ 'update:modelValue' ])

const iconCache = new Map<string, string>();

function sidcIcon(sidc: string): string {
    let icon = iconCache.get(sidc);

    if (!icon) {
        icon = new ms.Symbol(sidc, { size: props.size }).toDataURL();
        iconCache.set(sidc, icon);
    }

    return icon;
}

watch(config.value, () => {
    emit('update:modelValue', config.value.mode);
})
</script>

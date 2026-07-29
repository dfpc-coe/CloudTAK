<template>
    <div class='col-12'>
        <IconAlertTriangle
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label
            class='subheader user-select-none'
            v-text='"Priority"'
        />
        <div class='mx-2 pt-1'>
            <TablerEnum
                v-if='props.edit'
                :model-value='props.modelValue'
                label=''
                :options='PRIORITIES'
                @update:model-value='emit("update:modelValue", String($event))'
            />
            <TablerBadge
                v-else
                :background-color='display.background'
                :border-color='display.border'
                :text-color='display.text'
            >
                {{ display.label }}
            </TablerBadge>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TablerBadge, TablerEnum } from '@tak-ps/vue-tabler';
import { IconAlertTriangle } from '@tabler/icons-vue';

const PRIORITIES = ['none', 'low', 'medium', 'high', 'critical'];

const COLOURS: Record<string, { background: string, border: string, text: string }> = {
    none: { background: 'rgba(107, 121, 144, 0.15)', border: 'rgba(107, 121, 144, 0.4)', text: '#6b7990' },
    low: { background: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' },
    medium: { background: 'rgba(245, 159, 0, 0.15)', border: 'rgba(245, 159, 0, 0.4)', text: '#f59f00' },
    high: { background: 'rgba(245, 101, 34, 0.15)', border: 'rgba(245, 101, 34, 0.4)', text: '#f56522' },
    critical: { background: 'rgba(214, 51, 108, 0.15)', border: 'rgba(214, 51, 108, 0.4)', text: '#d6336c' },
};

const props = defineProps<{
    modelValue: string;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>();

const display = computed(() => {
    return {
        ...(COLOURS[props.modelValue] || COLOURS.none),
        label: props.modelValue.charAt(0).toUpperCase() + props.modelValue.slice(1),
    };
});
</script>

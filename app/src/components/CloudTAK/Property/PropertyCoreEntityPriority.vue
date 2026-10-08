<template>
    <PropertyFactRow label='Priority'>
        <TablerPillGroup
            v-if='edit'
            :model-value='modelValue'
            :options='options'
            size='sm'
            :rounded='false'
            padding=''
            @update:model-value='emit("update:modelValue", $event)'
        />
        <TablerBadge
            v-else
            :background-color='badge.background'
            :border-color='badge.border'
            :text-color='badge.text'
        >
            {{ badge.label }}
        </TablerBadge>
    </PropertyFactRow>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TablerBadge, TablerPillGroup } from '@tak-ps/vue-tabler';
import PropertyFactRow from '../util/PropertyFactRow.vue';
import { PRIORITIES, priorityBadge } from '../../../utils/priority.ts';

const props = defineProps<{
    modelValue: string;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>();

const options = PRIORITIES.map((priority) => ({
    value: priority,
    label: priorityBadge(priority).label,
}));

const badge = computed(() => priorityBadge(props.modelValue));
</script>

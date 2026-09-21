<template>
    <CollapsibleCard
        label='Alarm Configuration'
        :summary='summary'
    >
        <template #icon>
            <IconAlarm
                :size='32'
                stroke='1'
                class='text-muted'
            />
        </template>

        <div class='row g-2'>
            <div class='col-12'>
                <TablerEnum
                    v-model='alarm.priority'
                    label='Alarm Urgency'
                    :disabled='disabled'
                    :options='["off", "high", "low"]'
                />
            </div>

            <TablerInlineAlert
                v-if='alarm.priority === "high"'
                severity='danger'
                title='High Urgency Alarms'
                description='Use only for mission-critical layers that require immediate attention'
                :dismissable='false'
            />
            <TablerInlineAlert
                v-else-if='alarm.priority === "low"'
                severity='info'
                title='Low Urgency Alarms'
                description='Use for layers that are important but not mission-critical'
                :dismissable='false'
            />

            <template v-if='alarm.priority !== "off"'>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='alarm.alarm_evals'
                        label='Evaluation Periods'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='alarm.alarm_points'
                        label='Data Points to Alarm'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='alarm.alarm_period'
                        label='Period (seconds)'
                        :disabled='disabled'
                        type='number'
                        min='2'
                        step='1'
                    />
                </div>
            </template>
        </div>
    </CollapsibleCard>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import type { ETLLayer } from '../../types.ts';
import { IconAlarm } from '@tabler/icons-vue';
import CollapsibleCard from './CollapsibleCard.vue';
import {
    TablerEnum,
    TablerInput,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';

type AlarmConfig = Pick<ETLLayer, 'priority' | 'alarm_evals' | 'alarm_points' | 'alarm_period'>;

const props = withDefaults(defineProps<{
    modelValue: ETLLayer;
    disabled?: boolean;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: ETLLayer): void;
}>();

const alarm = ref<AlarmConfig>(fromLayer(props.modelValue));

const summary = computed(() => {
    if (alarm.value.priority === 'off') return 'Alarms Disabled';

    const urgency = alarm.value.priority === 'high' ? 'High' : 'Low';
    return `${urgency} Urgency - ${alarm.value.alarm_points} of ${alarm.value.alarm_evals} periods of ${alarm.value.alarm_period}s`;
});

watch(() => props.modelValue, (layer) => {
    const next = fromLayer(layer);
    if (JSON.stringify(next) !== JSON.stringify(alarm.value)) {
        alarm.value = next;
    }
}, {
    deep: true
});

watch(alarm, () => {
    emit('update:modelValue', {
        ...props.modelValue,
        priority: alarm.value.priority,
        alarm_evals: Number(alarm.value.alarm_evals),
        alarm_points: Number(alarm.value.alarm_points),
        alarm_period: Number(alarm.value.alarm_period),
    });
}, {
    deep: true
});

function fromLayer(layer: ETLLayer): AlarmConfig {
    return {
        priority: layer.priority,
        alarm_evals: layer.alarm_evals,
        alarm_points: layer.alarm_points,
        alarm_period: layer.alarm_period,
    };
}
</script>

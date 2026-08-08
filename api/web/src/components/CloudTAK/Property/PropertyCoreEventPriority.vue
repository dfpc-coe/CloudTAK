<template>
    <div class='col-12'>
        <div class='d-flex align-items-center'>
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
            <div class='ms-auto d-flex align-items-center me-2'>
                <span
                    v-if='!props.active && props.ended'
                    class='mx-2 text-muted cursor-pointer'
                    @click='relative = !relative'
                    v-text='relative ? timediff(props.ended) : props.ended'
                />

                <TablerBadge
                    v-if='props.active'
                    background-color='rgba(47, 179, 68, 0.15)'
                    border-color='rgba(47, 179, 68, 0.4)'
                    text-color='#2fb344'
                >
                    Active
                </TablerBadge>
                <TablerBadge
                    v-else
                    background-color='rgba(107, 121, 144, 0.15)'
                    border-color='rgba(107, 121, 144, 0.4)'
                    text-color='#6b7990'
                >
                    Ended
                </TablerBadge>

                <TablerIconButton
                    v-if='props.edit'
                    :title='props.active ? "End Event" : "Reactivate Event"'
                    @click='emit("update:active", !props.active)'
                >
                    <IconPlayerStop
                        v-if='props.active'
                        :size='20'
                        stroke='1'
                    />
                    <IconPlayerPlay
                        v-else
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
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
import { ref, computed } from 'vue';
import { TablerBadge, TablerEnum, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconAlertTriangle, IconPlayerStop, IconPlayerPlay } from '@tabler/icons-vue';
import timediff from '../../../timediff';

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
    /** Whether the Event is currently Active */
    active: boolean;
    /** Time at which the Event ended */
    ended: string | null;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'update:active', value: boolean): void
}>();

const relative = ref(true);

const display = computed(() => {
    return {
        ...(COLOURS[props.modelValue] || COLOURS.none),
        label: props.modelValue.charAt(0).toUpperCase() + props.modelValue.slice(1),
    };
});
</script>

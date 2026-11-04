<template>
    <PropertyMeasureRow
        :label='label'
        :model-value='inMode'
        :unit='mode'
        :inline='inline'
        :units='UNITS'
        @update:unit='mode = $event'
    />
</template>

<script setup lang='ts'>
import { ref, computed, watchEffect } from 'vue';
import PropertyMeasureRow from '../util/PropertyMeasureRow.vue';
import type { UnitOption } from '../util/UnitSwitcher.vue';

const UNITS: Array<UnitOption> = [
    { value: 'mi/h', label: 'mph', title: 'Miles Per Hour' },
    { value: 'km/h', label: 'km/h', title: 'Kilometers Per Hour' },
    { value: 'm/s', label: 'm/s', title: 'Meters Per Second' },
];

const props = defineProps({
    label: {
        type: String,
        default: 'Speed'
    },
    speed: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'mi/h'
    }
,
    inline: {
        type: Boolean,
        default: false
    }
});

const mode = ref(props.unit);

watchEffect(() => {
    mode.value = props.unit;
});

const inMode = computed(() => {
    if (mode.value === 'm/s') return Math.round(props.speed * 1000) / 1000;
    else if (mode.value === 'mi/h') return Math.round(props.speed * 2.23694 * 100) / 100;
    else if (mode.value === 'km/h') return Math.round(props.speed * 3.6 * 100) / 100;
    return 'UNKNOWN';
});
</script>

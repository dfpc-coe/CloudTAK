<template>
    <PropertyMeasureRow
        :label='label'
        :model-value='config.bearing'
        :unit='mode'
        :units='UNITS'
        :inline='inline'
        :edit='edit'
        :hover='hover'
        @update:model-value='config.bearing = Number($event)'
        @update:unit='changeMode($event)'
    />
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import PropertyMeasureRow from '../util/PropertyMeasureRow.vue';
import type { UnitOption } from '../util/UnitSwitcher.vue';

const UNITS: Array<UnitOption> = [
    { value: 'deg', label: 'deg', title: 'Degrees' },
    { value: 'rad', label: 'rad', title: 'Radians' },
    { value: 'mil', label: 'mil', title: 'Mil-Radians' },
];

const emit = defineEmits([
    'update:modelValue'
]);

const props = defineProps({
    label: {
        type: String,
        default: 'Bearing'
    },
    modelValue: {
        type: Number,
        required: true,
        description: 'Initial Degrees'
    },
    unit: {
        type: String,
        default: 'deg',
        description: 'Desired default unit'
    },
    hover: {
        type: Boolean,
        default: false
    },
    edit: {
        type: Boolean,
        default: false
    }
,
    inline: {
        type: Boolean,
        default: false
    }
});

const mode = ref(props.unit);

const config = ref({
    // Units coming into props should always be Deg
    bearing: toCustom(mode.value, props.modelValue)
});

watch(config.value, () => {
    emit(
        'update:modelValue',
        toDegrees(mode.value, config.value.bearing)
    );
});

function toDegrees(mode: string, bearing: number): number {
    if (mode === 'rad') {
        return bearing * 57.295779513;
    } else if (mode === 'mil') {
        return bearing * 0.05625;
    } else if (mode === 'deg') {
        return bearing;
    } else {
        throw new Error(`Invalid Bearing Unit: ${mode}`);
    }
}

function toCustom(mode: string, degrees: number): number {
    if (mode === 'deg') {
        return Math.round(degrees * 1000) / 1000;
    } else if (mode === 'rad') {
        return Math.round((degrees * 0.0174533) * 1000) / 1000;
    } else if (mode === 'mil') {
        return Math.round((degrees * 17.777778) * 1000) / 1000;
    } else {
        throw new Error(`Invalid Bearing Unit: ${mode}`);
    }
}

function changeMode(newMode: string): void {
    if (mode.value === newMode) return;

    const degrees = toDegrees(mode.value, config.value.bearing);

    config.value.bearing = toCustom(newMode, degrees);

    mode.value = newMode;
}
</script>

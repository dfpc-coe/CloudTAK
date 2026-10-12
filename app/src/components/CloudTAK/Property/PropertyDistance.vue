<template>
    <PropertyMeasureRow
        :label='label'
        :model-value='config.distance'
        :unit='mode'
        :units='UNITS'
        :edit='edit'
        :hover='hover'
        @update:model-value='config.distance = Number($event)'
        @update:unit='changeMode($event)'
        @submit='submitDistance($event)'
    />
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import PropertyMeasureRow from '../util/PropertyMeasureRow.vue';
import type { UnitOption } from '../util/UnitSwitcher.vue';

const UNITS: Array<UnitOption> = [
    { value: 'feet', label: 'ft', title: 'Feet' },
    { value: 'yard', label: 'yd', title: 'Yards' },
    { value: 'meter', label: 'm', title: 'Meters' },
    { value: 'kilometer', label: 'km', title: 'Kilometers' },
    { value: 'mile', label: 'mi', title: 'Miles' },
];

const emit = defineEmits([
    'submit',
    'update:modelValue'
]);

const props = defineProps({
    label: {
        type: String,
        default: 'Distance'
    },
    modelValue: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'mile'
    },
    hover: {
        type: Boolean,
        default: false
    },
    edit: {
        type: Boolean,
        default: false
    }
})

const mode = ref(props.unit);

const config = ref({
    // Units coming into props should always be kilometers
    distance: toCustom(mode.value, props.modelValue)
});

watch(config.value, () => {
    emit(
        'update:modelValue',
        toKilometers(mode.value, config.value.distance)
    );
});

watch(() => props.modelValue, (nextDistance) => {
    // Skip echoes of our own emit, otherwise unit rounding loops forever
    if (toKilometers(mode.value, Number(config.value.distance)) === nextDistance) return;
    config.value.distance = toCustom(mode.value, nextDistance);
});

watch(() => props.unit, (nextUnit) => {
    mode.value = nextUnit;
    config.value.distance = toCustom(nextUnit, props.modelValue);
});

/**
 * Convert any distance unit to kilometers
 */
function toKilometers(mode: string, distance: number): number {
    if (mode === 'mile') {
        return distance * 1.609344;
    } else if (mode === 'feet') {
        return distance * 0.0003048;
    } else if (mode === 'yard') {
        return distance * 0.0009144;
    } else if (mode === 'meter') {
        return distance * 0.001;
    } else if (mode === 'kilometer') {
        return distance;
    } else {
        throw new Error(`Invalid Distance Unit: ${mode}`);
    }
}

function toCustom(mode: string, kilometers: number): number {
    if (mode === 'kilometer') {
        return kilometers
    } else if (mode === 'feet') {
        return Math.round((kilometers / 0.0003048) * 1000) / 1000;
    } else if (mode === 'yard') {
        return Math.round((kilometers / 0.0009144) * 1000) / 1000;
    } else if (mode === 'mile') {
        return Math.round((kilometers / 1.609344) * 1000) / 1000;
    } else if (mode === 'meter') {
        return kilometers * 1000;
    } else {
        throw new Error(`Invalid Distance Unit: ${mode}`);
    }
}

function changeMode(newMode: string): void {
    if (mode.value === newMode) return;

    const kilometers = toKilometers(mode.value, config.value.distance);

    config.value.distance = toCustom(newMode, kilometers);

    mode.value = newMode;
}

function submitDistance(distance: string | number): void {
    const distanceValue = Number(distance);
    if (!Number.isFinite(distanceValue)) return;

    emit('submit', toKilometers(mode.value, distanceValue));
}
</script>

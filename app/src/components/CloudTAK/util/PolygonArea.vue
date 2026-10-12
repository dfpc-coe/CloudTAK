<template>
    <PropertyMeasureRow
        label='Area'
        :model-value='inMode'
        :unit='mode'
        :units='UNITS'
        @update:unit='mode = $event'
    />
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import { area } from '@turf/area';
import PropertyMeasureRow from './PropertyMeasureRow.vue';
import type { UnitOption } from './UnitSwitcher.vue';
import type { Geometry } from 'geojson';

const UNITS: Array<UnitOption> = [
    { value: 'square feet', label: 'ft²', title: 'Square Feet' },
    { value: 'square meter', label: 'm²', title: 'Square Meters' },
    { value: 'acre', label: 'acres', title: 'Acres' },
    { value: 'hectare', label: 'ha', title: 'Hectares' },
];

const props = withDefaults(defineProps<{
    geometry: Geometry;
    unit?: string;
}>(), {
    unit: 'acre'
});

const mode = ref(props.unit || 'acre');

watch(() => props.unit, (unit) => {
    mode.value = unit || 'acre';
});

const inMode = computed(() => {
    const cotArea = area(props.geometry);

    if (mode.value === 'square feet') {
        return Math.round((cotArea * 10.7639) * 1000) / 1000;
    } else if (mode.value === 'square meter') {
        return Math.round(cotArea * 1000) / 1000;
    } else if (mode.value === 'acre') {
        return Math.round((cotArea * 0.000247105) * 1000) / 1000;
    } else if (mode.value === 'hectare') {
        return Math.round((cotArea * 0.0001) * 1000) / 1000;
    } else {
        return 'UNKNOWN';
    }
})
</script>

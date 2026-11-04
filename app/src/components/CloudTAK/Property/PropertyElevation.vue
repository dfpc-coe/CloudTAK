<template>
    <PropertyMeasureRow
        :label='label'
        :model-value='inMode'
        :unit='mode'
        :units='UNITS'
        @update:unit='mode = $event'
    />
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import PropertyMeasureRow from '../util/PropertyMeasureRow.vue';
import type { UnitOption } from '../util/UnitSwitcher.vue';
import ProfileConfig from '../../../base/profile.ts';

const UNITS: Array<UnitOption> = [
    { value: 'feet', label: 'ft', title: 'Feet' },
    { value: 'meter', label: 'm', title: 'Meters' },
];

const props = defineProps({
    label: {
        type: String,
        default: 'Elevation'
    },
    elevation: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'feet'
    }
})

const mode = ref(props.unit);

onMounted(async () => {
    const displayElevation = await ProfileConfig.get('display_elevation');
    if (displayElevation?.value) mode.value = displayElevation.value;
});

watch(mode, async (val) => {
    const config = new ProfileConfig('display_elevation', val as 'feet' | 'meter');
    await config.commit(val as 'feet' | 'meter');
});

const UNKNOWN_ALTITUDE = 9999999;

const inMode = computed(() => {
    if (!Number.isFinite(props.elevation) || props.elevation === UNKNOWN_ALTITUDE) {
        return '--';
    } else if (mode.value === 'feet') {
        return Math.round(props.elevation * 3.28084 * 100) / 100;
    } else if (mode.value === 'meter') {
        return Math.round(props.elevation * 100) / 100;
    } else {
        return 'UNKNOWN';
    }
})
</script>

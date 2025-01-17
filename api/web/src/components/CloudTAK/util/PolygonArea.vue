<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Polygon Area</label>
        <div class='mx-2'>
            <CopyField
                v-model='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Square Feet"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "sqfeet",
                    "cursor-pointer": mode !== "sqfeet",
                }'
                @click='mode = "sqfeet"'
            >Feet<sup>2</sup></span>
            <span
                v-tooltip='"Square Meters"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "sqmeter",
                    "cursor-pointer": mode !== "sqmeter",
                }'
                @click='mode = "sqmeter"'
            >Meters<sup>2</sup></span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { area } from '@turf/area';
import CopyField from './CopyField.vue';
import COT from '../../../stores/base/cot.ts';

const props = defineProps({
    cot: {
        type: COT,
        required: true
    },
    unit: {
        type: String,
        default: 'sqfeet'
    }
})

const mode = ref(props.unit || 'sqfeet');

const inMode = computed(() => {
    const cotArea = area(props.cot.geometry);

    if (mode.value === 'sqfeet') {
        return cotArea * 10.7639;
    } else if (mode.value === 'sqmeter') {
        return cotArea;
    } else {
        return 'UNKNOWN';
    }
})
</script>

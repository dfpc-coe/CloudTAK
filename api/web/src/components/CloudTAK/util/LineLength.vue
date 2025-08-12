<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Line Length</label>
        <div class='mx-2'>
            <CopyField
                v-model='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Feet"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "feet",
                    "cursor-pointer": mode !== "feet",
                }'
                role='menuitem'
                tabindex='0'
                @keyup.enter='mode = "feet"'
                @click='mode = "feet"'
            >Feet</span>
            <span
                v-tooltip='"Yards"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "yard",
                    "cursor-pointer": mode !== "yard",
                }'
                role='menuitem'
                tabindex='0'
                @keyup.enter='mode = "yard"'
                @click='mode = "yard"'
            >Yards</span>
            <span
                v-tooltip='"Meters"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "meter",
                    "cursor-pointer": mode !== "meter",
                }'
                role='menuitem'
                tabindex='0'
                @keyup.enter='mode = "meter"'
                @click='mode = "meter"'
            >Meters</span>
            <span
                v-tooltip='"Kilometers"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "kilometer",
                    "cursor-pointer": mode !== "kilometer",
                }'
                role='menuitem'
                tabindex='0'
                @keyup.enter='mode = "kilometer"'
                @click='mode = "kilometer"'
            >Kilometers</span>
            <span
                v-tooltip='"Miles"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "mile",
                    "cursor-pointer": mode !== "mile",
                }'
                role='menuitem'
                tabindex='0'
                @keyup.enter='mode = "mile"'
                @click='mode = "mile"'
            >Miles</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { length } from '@turf/length';
import CopyField from './CopyField.vue';
import COT from '../../../base/cot.ts';

const props = defineProps({
    cot: {
        type: COT,
        required: true
    },
    unit: {
        type: String,
        default: 'mile'
    }
})

const mode = ref(props.unit || 'mile');

const inMode = computed(() => {
    if (props.cot.geometry.type !== 'LineString') return 'Not a Line!';

    const cotLength = length(props.cot.as_feature());

    if (mode.value === 'meter') {
        return cotLength * 1000;
    } else if (mode.value === 'feet') {
        return Math.round((cotLength * 3280.84) * 1000) / 1000;
    } else if (mode.value === 'yard') {
        return Math.round((cotLength * 1093.61) * 1000) / 1000;
    } else if (mode.value === 'kilometer') {
        return cotLength;
    } else if (mode.value === 'mile') {
        return cotLength * 0.621371;
    } else {
        return 'UNKNOWN';
    }
})
</script>

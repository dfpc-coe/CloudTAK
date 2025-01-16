<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Polygon Area</label>
        <div class='mx-2'>
            <CopyField
                v-model='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Feet"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "feet",
                    "cursor-pointer": mode !== "feet",
                }'
                @click='mode = "feet"'
            >Feet</span>
            <span
                v-tooltip='"Meters"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "meter",
                    "cursor-pointer": mode !== "meter",
                }'
                @click='mode = "meter"'
            >Meters</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import CopyField from './CopyField.vue';

const props = defineProps({
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

const inMode = computed(() => {
    if (mode.value === 'feet') {
        return Math.round(props.elevation * 3.28084 * 1000) / 1000;
    } else if (mode.value === 'meter') {
        return Math.round(props.elevation * 100) / 100;
    } else {
        return 'UNKNOWN';
    }
})
</script>

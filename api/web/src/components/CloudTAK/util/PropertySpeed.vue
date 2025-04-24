<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Speed</label>
        <div class='mx-2'>
            <CopyField
                v-model='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Meters Per Second"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "m/s",
                    "cursor-pointer": mode !== "m/s",
                }'
                @click='mode = "m/s"'
            >M/S</span>
            <span
                v-tooltip='"Miles Per Hour"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "mi/h",
                    "cursor-pointer": mode !== "mi/h",
                }'
                @click='mode = "mi/h"'
            >MPH</span>
            <span
                v-tooltip='"Kilometers Per Hour"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "km/h",
                    "cursor-pointer": mode !== "km/h",
                }'
                @click='mode = "km/h"'
            >KM/H</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import CopyField from './CopyField.vue';

const props = defineProps({
    speed: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'mi/h'
    }
});

const mode = ref(props.unit);

const inMode = computed(() => {
    if (mode.value === 'm/s') return Math.round(props.speed * 1000) / 1000;
    else if (mode.value === 'mi/h') return Math.round(props.speed * 2.23694 * 100) / 100;
    else if (mode.value === 'km/h') return Math.round(props.speed * 3.6 * 100) / 100;
    return 'UNKNOWN';
});
</script>

<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Course</label>
        <div class='mx-2'>
            <CopyField
                v-model='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Degrees"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "deg",
                    "cursor-pointer": mode !== "deg",
                }'
                @click='mode = "deg"'
            >Deg</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import CopyField from './CopyField.vue';

const props = defineProps({
    course: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'deg'
    }
});

const mode = ref(props.unit);

const inMode = computed(() => {
    if (mode.value === 'deg') return Math.round((props.course) * 1000) / 1000;
    return 'UNKNOWN';
});
</script>

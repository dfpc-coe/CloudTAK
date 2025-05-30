<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Distance</label>
        <div class='mx-2'>
            <CopyField
                v-model='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Meters"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "meter",
                    "cursor-pointer": mode !== "meter",
                }'
                role='menuitem'
                tabindex='0'
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
                @click='mode = "mile"'
            >Miles</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import CopyField from './CopyField.vue';

const props = defineProps({
    modelValue: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'mile'
    }
})

const mode = ref(props.unit || 'mile');

const inMode = computed(() => {
    if (mode.value === 'meter') {
        return props.modelValue * 1000;
    } else if (mode.value === 'kilometer') {
        return props.modelValue;
    } else if (mode.value === 'mile') {
        return props.modelValue * 0.621371;
    } else {
        return 'UNKNOWN';
    }
})
</script>

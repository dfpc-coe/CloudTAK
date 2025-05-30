<template>
    <div class='col-12'>
        <label class='subheader mx-2' v-text='props.label'/>
        <div class='mx-2'>
            <CopyField
                :model-value='inMode'
                :edit='props.edit'
                :hover='props.hover'
                :size='24'
            />
            <span
                v-tooltip='"Degrees"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "deg",
                    "cursor-pointer": mode !== "deg",
                }'
                role='menuitem'
                tabindex='0'
                @click='mode = "deg"'
            >Deg</span>
            <span
                v-tooltip='"Radians"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "rad",
                    "cursor-pointer": mode !== "rad",
                }'
                role='menuitem'
                tabindex='0'
                @click='mode = "rad"'
            >Rads</span>
            <span
                v-tooltip='"Mil-Radians"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "mil",
                    "cursor-pointer": mode !== "mil",
                }'
                role='menuitem'
                tabindex='0'
                @click='mode = "mil"'
            >Mils</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import CopyField from './CopyField.vue';

const props = defineProps({
    label: {
        type: String,
        default: 'Bearing'
    },
    modelValue: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'deg'
    },
    hover: {
        type: Boolean,
        default: false
    },
    edit: {
        type: Boolean,
        default: false
    }
});

const mode = ref(props.unit);

const inMode = computed(() => {
    if (mode.value === 'deg') {
        return Math.round((props.modelValue) * 1000) / 1000;
    } else if (mode.value === 'rad') {
        return Math.round((props.modelValue * 0.0174533) * 1000) / 1000;
    } else if (mode.value === 'mil') {
        return Math.round((props.modelValue * 17.777778) * 1000) / 1000;
    } else {
        return 'UNKNOWN';
    }
});
</script>

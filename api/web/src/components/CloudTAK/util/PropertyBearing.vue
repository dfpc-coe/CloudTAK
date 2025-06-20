<template>
    <div class='col-12'>
        <IconCompass
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label
            class='subheader user-select-none'
            v-text='props.label'
        />
        <div class='mx-2'>
            <CopyField
                v-model='config.bearing'
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
                @keyup.enter='changeMode("deg")'
                @click='changeMode("deg")'
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
                @keyup.enter='changeMode("rad")'
                @click='changeMode("rad")'
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
                @keyup.enter='changeMode("mil")'
                @click='changeMode("mil")'
            >Mils</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import CopyField from './CopyField.vue';
import {
    IconCompass
} from '@tabler/icons-vue';

const emit = defineEmits([
    'update:modelValue'
]);

const props = defineProps({
    label: {
        type: String,
        default: 'Bearing'
    },
    modelValue: {
        type: Number,
        required: true,
        description: 'Initial Degrees'
    },
    unit: {
        type: String,
        default: 'deg',
        description: 'Desired default unit'
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

const config = ref({
    // Units coming into props should always be Deg
    bearing: toCustom(mode.value, props.modelValue)
});

watch(config.value, () => {
    emit(
        'update:modelValue',
        toDegrees(mode.value, config.value.bearing)
    );
});

function toDegrees(mode: string, bearing: number): number {
    if (mode === 'rad') {
        return bearing * 57.295779513;
    } else if (mode === 'mil') {
        return bearing * 0.05625;
    } else if (mode === 'deg') {
        return bearing;
    } else {
        throw new Error(`Invalid Bearing Unit: ${mode}`);
    }
}

function toCustom(mode: string, degrees: number): number {
    if (mode === 'deg') {
        return Math.round(degrees * 1000) / 1000;
    } else if (mode === 'rad') {
        return Math.round((degrees * 0.0174533) * 1000) / 1000;
    } else if (mode === 'mil') {
        return Math.round((degrees * 17.777778) * 1000) / 1000;
    } else {
        throw new Error(`Invalid Bearing Unit: ${mode}`);
    }
}

function changeMode(newMode: string): void {
    if (mode.value === newMode) return;

    const degrees = toDegrees(mode.value, config.value.bearing);

    config.value.bearing = toCustom(newMode, degrees);

    mode.value = newMode;
}
</script>

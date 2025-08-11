<template>
    <div class='col-12'>
        <IconLine
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label class='subheader user-select-none'>Distance</label>
        <div class='mx-2'>
            <CopyField
                v-model='config.distance'
                :edit='props.edit'
                :hover='props.hover'
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
                @keyup.enter='changeMode("feet")'
                @click='changeMode("feet")'
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
                @keyup.enter='changeMode("yard")'
                @click='changeMode("yard")'
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
                @keyup.enter='changeMode("meter")'
                @click='changeMode("meter")'
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
                @keyup.enter='changeMode("kilometer")'
                @click='changeMode("kilometer")'
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
                @keyup.enter='changeMode("mile")'
                @click='changeMode("mile")'
            >Miles</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import CopyField from './CopyField.vue';
import {
    IconLine
} from '@tabler/icons-vue';

const emit = defineEmits([
    'update:modelValue'
]);

const props = defineProps({
    label: {
        type: String,
        default: 'Distance'
    },
    modelValue: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'mile'
    },
    hover: {
        type: Boolean,
        default: false
    },
    edit: {
        type: Boolean,
        default: false
    }
})

const mode = ref(props.unit);

const config = ref({
    // Units coming into props should always be kilometers
    distance: toCustom(mode.value, props.modelValue)
});

watch(config.value, () => {
    emit(
        'update:modelValue',
        toKilometers(mode.value, config.value.distance)
    );
});

function toKilometers(mode: string, distance: number): number {
    if (mode === 'mile') {
        return distance * 1.60934;
    } else if (mode === 'feet') {
        return distance / 0.0003048;
    } else if (mode === 'yard') {
        return distance / 0.0009144;
    } else if (mode === 'meter') {
        return distance / 1000;
    } else if (mode === 'kilometer') {
        return distance;
    } else {
        throw new Error(`Invalid Distance Unit: ${mode}`);
    }
}

function toCustom(mode: string, kilometers: number): number {
    if (mode === 'kilometer') {
        return kilometers
    } else if (mode === 'feet') {
        return Math.round((kilometers * 3280.84) * 1000) / 1000;
    } else if (mode === 'yard') {
        return Math.round((kilometers * 1093.61) * 1000) / 1000;
    } else if (mode === 'mile') {
        return Math.round((kilometers * 0.621371) * 1000) / 1000;
    } else if (mode === 'meter') {
        return kilometers * 1000;
    } else {
        throw new Error(`Invalid Bearing Unit: ${mode}`);
    }
}

function changeMode(newMode: string): void {
    if (mode.value === newMode) return;

    const degrees = toKilometers(mode.value, config.value.distance);

    config.value.distance = toCustom(newMode, degrees);

    mode.value = newMode;
}

</script>

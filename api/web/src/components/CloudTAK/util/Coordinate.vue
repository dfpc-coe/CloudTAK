<template>
    <div class='col-12'>
        <IconLabel
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label
            class='subheader user-select-none'
            v-text='label'
        />
        <div class='mx-2'>
            <CopyField
                :model-value='inMode'
                :edit='edit'
                :hover='hover'
                :validate='validateInput'
                :size='24'
                @submit='submitCoordinate($event)'
                @update:model-value='coordinateEntry($event)'
            />
            <template v-if='availableModes.length'>
                <div
                    role='menu'
                    class='mx-2'
                >
                    <span
                        v-for='mode in availableModes'
                        :key='mode.value'
                        v-tooltip='mode.title'
                        role='menuitem'
                        tabindex='0'
                        class='my-1 px-2 user-select-none'
                        :class='{
                            "cloudtak-accent rounded-bottom text-blue": config.mode === mode.value,
                            "cursor-pointer": config.mode !== mode.value,
                        }'
                        @click='config.mode = mode.value'
                    >{{ mode.label }}</span>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import CopyField from './CopyField.vue';
import { COORD_MODES, formatCoordPair, parseCoordPair, validateCoordPair, type CoordMode } from '../../../base/utils/coordinateFormat.ts';
import {
    IconLabel
} from '@tabler/icons-vue';
import { ref, computed, watch } from 'vue';

const props = defineProps({
    label: {
        type: String,
        default: 'Coordinates'
    },
    hover: {
        type: Boolean,
        default: false
    },
    edit: {
        type: Boolean,
        default: false
    },
    truncate: {
        type: Number,
        description: 'Truncate DD coordinates to a given precision',
        default: undefined
    },
    modes: {
        type: Array,
        default: function() {
            return COORD_MODES.map((mode) => mode.value)
        }
    },
    modelValue: {
        type: Array,
        required: true,
        description: 'A coordinate pair in GeoJSON format (lng,lat)'
    }
});

const emit = defineEmits([
    'submit',
    'update:modelValue',
]);

const config = ref({
    mode: (props.modes[0] || 'dd') as CoordMode
});

const availableModes = computed(() => {
    return COORD_MODES.filter((mode) => props.modes.includes(mode.value));
});

watch(() => props.modes, (nextModes) => {
    if (nextModes.length && !nextModes.includes(config.value.mode)) {
        config.value.mode = nextModes[0] as CoordMode;
    }
}, {
    immediate: true,
    deep: true
});

const validateInput = computed(() => {
    return (text: string): string => {
        return validateCoordPair(text, config.value.mode);
    }
});

const inMode = computed(() => {
    return formatCoordPair(
        props.modelValue[1] as number,
        props.modelValue[0] as number,
        config.value.mode,
        props.truncate
    );
});

function coordinateEntry(text: string | number) {
    if (typeof text !== 'string') return;

    try {
        const [lat, lng] = parseCoordPair(text, config.value.mode);
        emit('update:modelValue', [lng, lat]);
    } catch {
        // Validation handles the user-visible error state.
    }
}

function submitCoordinate(text: string | number) {
    coordinateEntry(text);
    emit('submit', text);
}
</script>

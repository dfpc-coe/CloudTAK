<template>
    <!-- Inline renders only the field so a caller can place it in a row of its own -->
    <component
        :is='inline ? "div" : PropertyFactRow'
        :label='inline ? undefined : label'
        :class='{ "py-1": !inline }'
    >
        <div>
            <CopyField
                :model-value='inMode'
                :edit='edit'
                :hover='hover'
                :validate='validateInput'
                :size='24'
                @submit='submitCoordinate($event)'
                @update:model-value='coordinateEntry($event)'
            />
            <UnitSwitcher
                v-if='availableModes.length > 1'
                :model-value='config.mode'
                :options='availableModes'
                @update:model-value='config.mode = $event as CoordMode'
            />
        </div>
    </component>
</template>

<script setup lang='ts'>
import CopyField from './CopyField.vue';
import UnitSwitcher from './UnitSwitcher.vue';
import PropertyFactRow from './PropertyFactRow.vue';
import { COORD_MODES, formatCoordPair, parseCoordPair, validateCoordPair, type CoordMode } from '../../../utils/coordinateFormat.ts';
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
    inline: {
        type: Boolean,
        description: 'Render only the field - the caller provides the label',
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
    emit('submit', text);
}
</script>

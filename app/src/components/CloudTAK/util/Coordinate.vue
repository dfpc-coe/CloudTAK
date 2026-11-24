<template>
    <!-- Inline renders only the field so a caller can place it in a row of its own -->
    <component
        :is='inline || labelPosition === "top" ? "div" : PropertyFactRow'
        :label='inline || labelPosition === "top" ? undefined : label'
        :class='{ "py-1": !inline }'
    >
        <label
            v-if='!inline && labelPosition === "top"'
            class='form-label'
            v-text='label'
        />
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
                :model-value='mode'
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
import { COORD_MODES, coordModesAt, formatCoordPair, parseCoordPair, validateCoordPair, type CoordMode } from '../../../utils/coordinateFormat.ts';
import { useMapStore } from '../../../stores/map.ts';
import { ref, computed, type PropType } from 'vue';

const mapStore = useMapStore();

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
    labelPosition: {
        type: String as PropType<'left' | 'top'>,
        description: 'Place the label beside the field or above it',
        default: 'left'
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
    mode: (props.modes.includes(mapStore.coordFormat) ? mapStore.coordFormat : props.modes[0] || 'dd') as CoordMode
});

const availableModes = computed(() => {
    const lng = Number(props.modelValue[0]);
    const lat = Number(props.modelValue[1]);

    const located = Number.isFinite(lat) && Number.isFinite(lng) ? coordModesAt(lat, lng) : COORD_MODES;

    return located.filter((mode) => props.modes.includes(mode.value));
});

const mode = computed<CoordMode>(() => {
    if (availableModes.value.some((available) => available.value === config.value.mode)) {
        return config.value.mode;
    }

    return availableModes.value[0]?.value || 'dd';
});

const validateInput = computed(() => {
    return (text: string): string => {
        return validateCoordPair(text, mode.value);
    }
});

const inMode = computed(() => {
    return formatCoordPair(
        props.modelValue[1] as number,
        props.modelValue[0] as number,
        mode.value,
        props.truncate
    );
});

function coordinateEntry(text: string | number) {
    if (typeof text !== 'string') return;

    try {
        const [lat, lng] = parseCoordPair(text, mode.value);
        emit('update:modelValue', [lng, lat]);
    } catch {
        // Validation handles the user-visible error state.
    }
}

function submitCoordinate(text: string | number) {
    emit('submit', text);
}
</script>

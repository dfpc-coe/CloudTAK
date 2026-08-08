<template>
    <TablerAlert
        v-if='error'
        :err='error'
    />
    <TablerLoading
        v-else-if='loading'
        :compact='true'
        desc='Loading Event Types'
    />
    <template v-else-if='presets.length && !custom'>
        <label class='form-label required'>Type</label>
        <div class='row g-2'>
            <div
                v-for='(preset, index) in presets'
                :key='index'
                class='col-6 col-md-4'
            >
                <div
                    class='border rounded py-3 px-2 h-100 d-flex flex-column align-items-center justify-content-center gap-2 cursor-pointer cloudtak-hover user-select-none'
                    :class='modelValue === preset.type ? "border-primary" : ""'
                    @click='selectPreset(preset)'
                >
                    <img
                        v-if='preset.icon'
                        :src='preset.icon'
                        :alt='preset.name'
                        style='width: 32px; height: 32px; object-fit: contain;'
                    >
                    <FeatureIcon
                        v-else
                        :key='preset.type'
                        :feature='{ properties: { type: preset.type } }'
                        :size='32'
                    />
                    <span
                        class='text-truncate w-100 text-center'
                        v-text='preset.name'
                    />
                </div>
            </div>
            <div class='col-6 col-md-4'>
                <div
                    class='border rounded py-3 px-2 h-100 d-flex flex-column align-items-center justify-content-center gap-2 cursor-pointer cloudtak-hover user-select-none'
                    @click='selectOther'
                >
                    <IconDots
                        :size='32'
                        stroke='1'
                    />
                    <span class='text-truncate w-100 text-center'>Other</span>
                </div>
            </div>
        </div>
    </template>
    <template v-else>
        <PropertyType
            :model-value='modelValue || DEFAULT_SIDC'
            :edit='true'
            @update:model-value='emit("update:modelValue", String($event))'
        />
        <button
            v-if='presets.length'
            class='btn btn-sm w-100 mt-2'
            @click='backToPresets'
        >
            Back to Preconfigured Types
        </button>
    </template>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { server } from '../../../std.ts';
import FeatureIcon from './FeatureIcon.vue';
import PropertyType from '../Property/PropertyType.vue';
import { IconDots } from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler';

type CoreEventTypePreset = {
    name: string;
    type: string;
    icon?: string;
};

// Activity/Event Symbol Set (40) - generic "Incident" entity, the seed shown
// in the PropertyType picker before a custom symbol has been chosen
const DEFAULT_SIDC = '10034000001100000000';

const props = defineProps({
    modelValue: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:modelValue']);

const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const custom = ref(false);
const presets = ref<CoreEventTypePreset[]>([]);

onMounted(async () => {
    await fetchPresets();

    if (!presets.value.length) {
        custom.value = true;
        if (!props.modelValue) emit('update:modelValue', DEFAULT_SIDC);
    }
});

function selectPreset(preset: CoreEventTypePreset): void {
    emit('update:modelValue', preset.type);
}

function selectOther(): void {
    custom.value = true;
    if (!props.modelValue) emit('update:modelValue', DEFAULT_SIDC);
}

function backToPresets(): void {
    custom.value = false;

    // Drop a custom symbol that doesn't correspond to a preset so the grid
    // never has an invisible selection
    if (!presets.value.some((preset) => preset.type === props.modelValue)) {
        emit('update:modelValue', '');
    }
}

async function fetchPresets(): Promise<void> {
    try {
        loading.value = true;
        const res = await server.GET('/api/config', {
            params: {
                query: {
                    keys: 'core::event::types'
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        presets.value = (res.data['core::event::types'] || []).filter((preset) => {
            return preset.name && preset.type;
        });
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>

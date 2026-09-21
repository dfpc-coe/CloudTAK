<template>
    <CollapsibleCard
        label='Infrastructure'
        :summary='summary'
    >
        <template #icon>
            <IconServer
                :size='32'
                stroke='1'
                class='text-muted'
            />
        </template>

        <div class='row g-2'>
            <div class='col-md-6'>
                <TablerInput
                    v-model='infra.memory'
                    label='Memory (Mb)'
                    :disabled='disabled'
                    type='number'
                    min='1'
                    step='1'
                />
            </div>
            <div class='col-md-6'>
                <TablerInput
                    v-model='infra.timeout'
                    label='Timeout (s)'
                    :disabled='disabled'
                    type='number'
                    min='1'
                    step='1'
                />
            </div>
        </div>
    </CollapsibleCard>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import type { ETLLayer } from '../../types.ts';
import { IconServer } from '@tabler/icons-vue';
import CollapsibleCard from './CollapsibleCard.vue';
import { TablerInput } from '@tak-ps/vue-tabler';

type InfraConfig = Pick<ETLLayer, 'memory' | 'timeout'>;

const props = withDefaults(defineProps<{
    modelValue: ETLLayer;
    disabled?: boolean;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: ETLLayer): void;
}>();

const infra = ref<InfraConfig>(fromLayer(props.modelValue));

const summary = computed(() => {
    return `${infra.value.memory} Mb Memory - ${infra.value.timeout}s Timeout`;
});

watch(() => props.modelValue, (layer) => {
    const next = fromLayer(layer);
    if (JSON.stringify(next) !== JSON.stringify(infra.value)) {
        infra.value = next;
    }
}, {
    deep: true
});

watch(infra, () => {
    emit('update:modelValue', {
        ...props.modelValue,
        memory: Number(infra.value.memory),
        timeout: Number(infra.value.timeout),
    });
}, {
    deep: true
});

function fromLayer(layer: ETLLayer): InfraConfig {
    return {
        memory: layer.memory,
        timeout: layer.timeout,
    };
}
</script>

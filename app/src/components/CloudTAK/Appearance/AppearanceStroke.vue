<template>
    <div>
        <ColorSwatches
            label='Stroke'
            :model-value='modelValue.stroke'
            @update:model-value='set("stroke", $event)'
        />

        <div class='row g-2 pt-2'>
            <div class='col-6'>
                <label class='subheader user-select-none d-block pb-1'>Line style</label>
                <TablerEnum
                    :model-value='modelValue.strokeStyle'
                    :options='STROKE_STYLES'
                    default='solid'
                    @update:model-value='set("strokeStyle", $event)'
                />
            </div>
            <div class='col-6'>
                <label class='subheader user-select-none d-block pb-1'>Width</label>
                <TablerRange
                    :model-value='modelValue.strokeWidth'
                    :default='1'
                    :min='1'
                    :max='6'
                    :step='1'
                    @update:model-value='set("strokeWidth", Number($event))'
                />
            </div>
        </div>

        <label class='subheader user-select-none d-block pt-2 pb-1'>Stroke opacity</label>
        <TablerRange
            :model-value='modelValue.strokeOpacity'
            :default='1'
            :min='0'
            :max='1'
            :step='0.01'
            @update:model-value='set("strokeOpacity", Number($event))'
        />

        <template v-if='fill'>
            <ColorSwatches
                class='pt-3'
                label='Fill'
                :model-value='modelValue.fill'
                @update:model-value='set("fill", $event)'
            />

            <label class='subheader user-select-none d-block pt-2 pb-1'>Fill opacity</label>
            <TablerRange
                :model-value='modelValue.fillOpacity'
                :default='1'
                :min='0'
                :max='1'
                :step='0.01'
                @update:model-value='set("fillOpacity", Number($event))'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { TablerEnum, TablerRange } from '@tak-ps/vue-tabler';
import ColorSwatches from './ColorSwatches.vue';
import { STROKE_STYLES } from '../../../utils/appearance.ts';
import type { StyleDraft } from '../../../utils/appearance.ts';

const props = defineProps<{
    modelValue: StyleDraft;
    /** Polygons expose fill controls */
    fill: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', style: StyleDraft): void;
}>();

function set<K extends keyof StyleDraft>(key: K, value: StyleDraft[K]): void {
    if (props.modelValue[key] === value) return;
    emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<template>
    <component
        :is='edit ? "button" : "div"'
        :type='edit ? "button" : undefined'
        class='appearance-row w-100 d-flex align-items-center rounded border px-2 py-2 text-start'
        :class='{ "appearance-row--edit cloudtak-hover": edit }'
        :title='edit ? "Edit Appearance" : undefined'
        @click='edit && emit("click")'
    >
        <FeatureIcon
            :key='iconKey'
            :size='32'
            :feature='{ properties, geometry }'
        />

        <div
            class='flex-grow-1 mx-2'
            style='min-width: 0;'
        >
            <div
                class='text-truncate'
                v-text='summary.title'
            />
            <div
                class='text-secondary small text-truncate'
                v-text='summary.subtitle'
            />
        </div>

        <IconChevronRight
            v-if='edit'
            :size='18'
            stroke='1.5'
            class='flex-shrink-0'
        />
    </component>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import { IconChevronRight } from '@tabler/icons-vue';
import FeatureIcon from '../util/FeatureIcon.vue';
import COT, { renderedIconImage } from '../../../base/cot.ts';
import type { Feature } from '../../../types.ts';
import { describeAppearance, describeStyle, isIconsetIcon } from '../../../utils/appearance.ts';
import { iconsetIconLabel } from './icon-label.ts';

const props = defineProps<{
    properties: Feature['properties'];
    geometry: Feature['geometry'];
    edit: boolean;
}>();

const emit = defineEmits<{
    (e: 'click'): void;
}>();

const typeName = ref<string | undefined>();
const iconName = ref<string | undefined>();

const isPoint = computed<boolean>(() => props.geometry.type === 'Point');

const iconKey = computed<string>(() => {
    if (!isPoint.value) return `${props.properties.stroke}-${props.properties.fill}`;
    return renderedIconImage(props.properties) || props.properties.type;
});

const summary = computed(() => {
    if (!isPoint.value) return describeStyle(props.geometry.type, props.properties);
    return describeAppearance(props.properties, typeName.value, iconName.value);
});

watch(() => props.properties.type, async (type) => {
    typeName.value = undefined;
    if (!isPoint.value) return;

    const resolved = await COT.resolveType(type);
    if (type === props.properties.type) typeName.value = resolved.name;
}, { immediate: true });

watch(() => props.properties.icon, async (icon) => {
    iconName.value = undefined;
    if (!isIconsetIcon(icon)) return;

    const label = await iconsetIconLabel(icon as string);
    if (icon === props.properties.icon) iconName.value = label;
}, { immediate: true });
</script>

<style scoped>
.appearance-row {
    background: transparent;
    color: inherit;
}

.appearance-row--edit {
    cursor: pointer;
}
</style>

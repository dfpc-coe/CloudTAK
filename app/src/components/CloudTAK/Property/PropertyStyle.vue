<template>
    <!-- Raised so the icon picker's dropdown overlays the sections below -->
    <PropertySection
        label='Style'
        class='position-relative'
        style='z-index: 10;'
    >
        <template v-if='geometry === "Point"'>
            <div class='pb-1'>
                <IconSelect
                    :model-value='(modelValue.icon as string | undefined) ?? ""'
                    label='Icon'
                    :size='32'
                    stroke='1'
                    @update:model-value='updatePropertyIcon($event)'
                />
            </div>
            <PropertyFactRow
                label='Color'
                class='py-1'
            >
                <TablerInput
                    :model-value='modelValue["marker-color"]'
                    label=''
                    default='#FFFFFF'
                    type='color'
                    @update:model-value='updateProperty("marker-color", $event)'
                />
            </PropertyFactRow>
            <PropertyFactRow
                label='Opacity'
                class='py-1'
            >
                <TablerRange
                    :model-value='modelValue["marker-opacity"] ?? 1'
                    label=''
                    :default='1'
                    :min='0'
                    :max='1'
                    :step='0.01'
                    @update:model-value='updateProperty("marker-opacity", $event)'
                />
            </PropertyFactRow>
        </template>
        <template v-else>
            <PropertyFactRow
                label='Stroke'
                class='py-1'
            >
                <TablerInput
                    :model-value='modelValue["stroke"]'
                    label=''
                    type='color'
                    @update:model-value='updateProperty("stroke", $event)'
                />
            </PropertyFactRow>
            <PropertyFactRow
                label='Line Style'
                class='py-1'
            >
                <TablerEnum
                    :model-value='modelValue["stroke-style"] ?? "solid"'
                    label=''
                    :options='["solid", "dashed", "dotted", "outlined"]'
                    default='solid'
                    @update:model-value='updateProperty("stroke-style", $event)'
                />
            </PropertyFactRow>
            <PropertyFactRow
                label='Width'
                class='py-1'
            >
                <TablerRange
                    :model-value='modelValue["stroke-width"] ?? 1'
                    label=''
                    :default='1'
                    :min='1'
                    :max='6'
                    :step='1'
                    @update:model-value='updateProperty("stroke-width", $event)'
                />
            </PropertyFactRow>
            <PropertyFactRow
                label='Opacity'
                class='py-1'
            >
                <TablerRange
                    :model-value='modelValue["stroke-opacity"] ?? 1'
                    label=''
                    :default='1'
                    :min='0'
                    :max='1'
                    :step='0.01'
                    @update:model-value='updateProperty("stroke-opacity", $event)'
                />
            </PropertyFactRow>
        </template>
        <template v-if='geometry === "Polygon" || geometry === "MultiPolygon"'>
            <PropertyFactRow
                label='Fill'
                class='py-1'
            >
                <TablerInput
                    :model-value='modelValue["fill"]'
                    label=''
                    type='color'
                    @update:model-value='updateProperty("fill", $event)'
                />
            </PropertyFactRow>
            <PropertyFactRow
                label='Fill Opacity'
                class='py-1'
            >
                <TablerRange
                    :model-value='modelValue["fill-opacity"] ?? 1'
                    label=''
                    :default='1'
                    :min='0'
                    :max='1'
                    :step='0.01'
                    @update:model-value='updateProperty("fill-opacity", $event)'
                />
            </PropertyFactRow>
        </template>
    </PropertySection>
</template>

<script setup lang='ts'>
import Type2525 from '@tak-ps/node-cot/2525';
import PropertySection from '../util/PropertySection.vue';
import PropertyFactRow from '../util/PropertyFactRow.vue';
import {
    TablerInput,
    TablerRange,
    TablerEnum,
} from '@tak-ps/vue-tabler';
import IconSelect from '../util/IconSelectOffline.vue';

type StyleProperties = Record<string, unknown>;

const props = defineProps<{
    geometry: string,
    modelValue: StyleProperties
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: StyleProperties): void
}>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateProperty(key: string, event: any) {
    const properties = { ...props.modelValue };

    if (typeof event === 'string' || typeof event === 'number') {
        if (properties[key] !== event) {
            properties[key] = event;
            emit('update:modelValue', properties);
        }
    } else {
        properties[key] = event;
        emit('update:modelValue', properties);
    }
}

function updatePropertyIcon(event: string | null) {
    if (event) {
        event = event.replace(/\.png$/g, '');
        if (!event.includes(':') && event.includes('/')) {
            event = event.replace('/', ':');
        }
    }

    const properties = { ...props.modelValue };

    if (
        event
        && (
            !properties.icon
            || (
                properties.icon
                && event !== properties.icon
            )
        )
    ) {
        properties.icon = event;
        properties["marker-color"] = '#FFFFFF';
        emit('update:modelValue', properties);
    } else if (properties.icon && !event) {
        // A MIL-STD symbol renders from the type with no icon set at all
        if (properties.type && Type2525.isNumericSIDCConvertable(String(properties.type))) {
            properties.icon = undefined;
        } else if (properties.type && properties.type !== 'u-d-p') {
            properties.icon = properties.type;
        } else {
            properties.icon = undefined;
        }

        emit('update:modelValue', properties);
    }
}
</script>



<template>
    <div
        class='col-12'
        :style='{ zIndex: expanded ? 10 : "auto", position: "relative" }'
    >
        <SlideDownHeader
            v-model='expanded'
            label='Style'
        >
            <template #icon>
                <IconPaint
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

            <div class='mx-2 py-2'>
                <div class='rounded cloudtak-accent px-2 py-2'>
                    <div class='row g-2'>
                        <template v-if='geometry === "Point"'>
                            <div class='col-12'>
                                <IconSelect
                                    :model-value='(modelValue.icon as string | undefined) ?? ""'
                                    label='Point Icon'
                                    :size='32'
                                    stroke='1'
                                    @update:model-value='updatePropertyIcon($event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Point Color</label>
                                <TablerInput
                                    :model-value='modelValue["marker-color"]'
                                    label=''
                                    default='#FFFFFF'
                                    type='color'
                                    class='pb-2'
                                    @update:model-value='updateProperty("marker-color", $event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Point Opacity</label>
                                <TablerRange
                                    :model-value='modelValue["marker-opacity"] ?? 1'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                    @update:model-value='updateProperty("marker-opacity", $event)'
                                />
                            </div>
                        </template>
                        <template v-else>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Colour</label>
                                <TablerInput
                                    :model-value='modelValue["stroke"]'
                                    label=''
                                    type='color'
                                    @update:model-value='updateProperty("stroke", $event)'
                                />
                            </div>

                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Style</label>
                                <TablerEnum
                                    :model-value='modelValue["stroke-style"] ?? "solid"'
                                    label=''
                                    :options='["solid", "dashed", "dotted", "outlined"]'
                                    default='solid'
                                    @update:model-value='updateProperty("stroke-style", $event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Thickness</label>
                                <TablerRange
                                    :model-value='modelValue["stroke-width"] ?? 1'
                                    label=''
                                    :default='1'
                                    :min='1'
                                    :max='6'
                                    :step='1'
                                    @update:model-value='updateProperty("stroke-width", $event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Opacity</label>
                                <TablerRange
                                    :model-value='modelValue["stroke-opacity"] ?? 1'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                    @update:model-value='updateProperty("stroke-opacity", $event)'
                                />
                            </div>
                        </template>
                        <template v-if='geometry === "Polygon" || geometry === "MultiPolygon"'>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Fill Colour</label>
                                <TablerInput
                                    :model-value='modelValue["fill"]'
                                    label=''
                                    type='color'
                                    @update:model-value='updateProperty("fill", $event)'
                                />
                            </div>
                            <div class='col-12 round'>
                                <label class='subheader user-select-none'>Fill Opacity</label>
                                <TablerRange
                                    :model-value='modelValue["fill-opacity"] ?? 1'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                    @update:model-value='updateProperty("fill-opacity", $event)'
                                />
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import { IconPaint } from '@tabler/icons-vue';
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

const expanded = ref(false);


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
        if (properties.type && properties.type !== 'u-d-p') {
            properties.icon = properties.type;
        } else {
            properties.icon = undefined;
        }

        emit('update:modelValue', properties);
    }
}
</script>



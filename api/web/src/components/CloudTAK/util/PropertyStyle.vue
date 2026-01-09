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
                <div class='rounded bg-accent px-2 py-2'>
                    <div class='row g-2'>
                        <template v-if='cot.geometry.type === "Point"'>
                            <div class='col-12'>
                                <IconSelect
                                    :model-value='cot.properties.icon'
                                    label='Point Icon'
                                    :size='32'
                                    stroke='1'
                                    @update:model-value='updatePropertyIcon($event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Point Color</label>
                                <TablerInput
                                    :model-value='cot.properties["marker-color"]'
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
                                    :model-value='cot.properties["marker-opacity"]'
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
                                    :model-value='cot.properties["stroke"]'
                                    label=''
                                    type='color'
                                    @update:model-value='updateProperty("stroke", $event)'
                                />
                            </div>

                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Style</label>
                                <TablerEnum
                                    :model-value='cot.properties["stroke-style"]'
                                    label=''
                                    :options='["solid", "dashed", "dotted", "outlined"]'
                                    default='solid'
                                    @update:model-value='updateProperty("stroke-style", $event)'
                                />
                            </div>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Line Thickness</label>
                                <TablerRange
                                    :model-value='cot.properties["stroke-width"]'
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
                                    :model-value='cot.properties["stroke-opacity"]'
                                    label=''
                                    :default='1'
                                    :min='0'
                                    :max='1'
                                    :step='0.01'
                                    @update:model-value='updateProperty("stroke-opacity", $event)'
                                />
                            </div>
                        </template>
                        <template v-if='cot.geometry.type === "Polygon" || cot.geometry.type === "MultiPolygon"'>
                            <div class='col-12'>
                                <label class='subheader user-select-none'>Fill Colour</label>
                                <TablerInput
                                    :model-value='cot.properties["fill"]'
                                    label=''
                                    type='color'
                                    @update:model-value='updateProperty("fill", $event)'
                                />
                            </div>
                            <div class='col-12 round'>
                                <label class='subheader user-select-none'>Fill Opacity</label>
                                <TablerRange
                                    :model-value='cot.properties["fill-opacity"]'
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
import SlideDownHeader from './SlideDownHeader.vue';
import { IconPaint } from '@tabler/icons-vue';
import {
    TablerInput,
    TablerRange,
    TablerEnum,
} from '@tak-ps/vue-tabler';
import IconSelect from '../../util/IconSelect.vue';
import type COT from '../../../base/cot';

const props = defineProps<{
    cot: COT
}>();

const expanded = ref(false);


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateProperty(key: string, event: any) {
    if (!props.cot) return;

    const properties = { ...props.cot.properties };

    if (typeof event === 'string' || typeof event === 'number') {
        if (properties[key] !== event) {
            properties[key] = event;
            props.cot.update({ properties });
        }
    } else {
        properties[key] = event;
        props.cot.update({ properties });
    }
}

function updatePropertyIcon(event: string | null) {
    if (!props.cot) return;

    if (event) {
        event = event.replace(/\.png$/g, '').replace(':', '/');
    }

    const properties = { ...props.cot.properties };

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
        props.cot.update({ properties });
    } else if (properties.icon && !event) {
        if (properties.type !== 'u-d-p') {
            properties.icon = properties.type;
        } else {
            properties.icon = undefined;
        }

        props.cot.update({ properties });
    }
}
</script>



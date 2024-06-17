<template>
    <div class='px-1 pb-2 col-12'>
        <label class='mx-1 subheader'>COT Style</label>
        <div class='mx-2 py-3'>
            <div class='row g-2 rounded px-2 bg-gray-500 pb-2'>
                <template v-if='feat.geometry.type === "Point"'>
                    <div class='col-12'>
                        <IconSelect
                            v-model='feat.properties.icon'
                            label='Point Icon'
                            size='32'
                        />
                    </div>
                    <div class='col-12'>
                        <label class='subheader'>Point Colour</label>
                        <TablerInput
                            v-model='feat.properties["marker-color"]'
                            default='#00FF00'
                            type='color'
                            class='pb-2'
                        />
                    </div>
                    <div class='col-12'>
                        <label class='subheader'>Point Opacity</label>
                        <TablerRange
                            v-model='feat.properties["marker-opacity"]'
                            :default='1'
                            :min='0'
                            :max='1'
                            :step='0.01'
                        />
                    </div>
                </template>
                <template v-else-if='feat.geometry.type !== "Point"'>
                    <div class='col-12'>
                        <label class='subheader'>Line Colour</label>
                        <TablerInput
                            v-model='feat.properties.stroke'
                            type='color'
                        />
                    </div>

                    <div class='col-12'>
                        <label class='subheader'>Line Style</label>
                        <TablerEnum
                            v-model='feat.properties["stroke-style"]'
                            :options='["solid", "dashed", "dotted", "outlined"]'
                            default='solid'
                        />
                    </div>
                    <div class='col-12'>
                        <label class='subheader'>Line Thickness</label>
                        <TablerRange
                            v-model='feat.properties["stroke-width"]'
                            :default='1'
                            :min='1'
                            :max='6'
                            :step='1'
                        />
                    </div>
                    <div class='col-12'>
                        <label class='subheader'>Line Opacity</label>
                        <TablerRange
                            v-model='feat.properties["stroke-opacity"]'
                            :default='1'
                            :min='0'
                            :max='1'
                            :step='0.01'
                        />
                    </div>
                </template>
                <template v-if='feat.geometry.type === "Polygon"'>
                    <div class='col-12'>
                        <label class='subheader'>Fill Colour</label>
                        <TablerInput
                            v-model='feat.properties.fill'
                            type='color'
                        />
                    </div>
                    <div class='col-12 round'>
                        <label class='subheader'>Fill Opacity</label>
                        <TablerRange
                            v-model='feat.properties["fill-opacity"]'
                            :default='1'
                            :min='0'
                            :max='1'
                            :step='0.01'
                        />
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script>
import IconSelect from '../../util/IconSelect.vue';
import {
    TablerRange,
    TablerInput,
    TablerEnum
} from '@tak-ps/vue-tabler';

export default {
    name: 'CoTStyle',
    components: {
        TablerRange,
        TablerEnum,
        TablerInput,
        IconSelect,
    },
    props: {
        modelValue: {
            type: Object,
            required: true
        },
    },
    data: function() {
        return {
            feat: this.modelValue,
        };
    }
}
</script>

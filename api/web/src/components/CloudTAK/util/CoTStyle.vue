<template>
<div class='col-12'>
    <label class='subheader'>COT Style</label>
    <div class='mx-3 py-3'>
        <div class='row g-2 rounded px-2 bg-gray-500'>
            <template v-if='feat.geometry.type === "Point"'>
                <div class='col-12'>
                    <IconSelect label='Point Icon' v-model='feat.properties.icon'/>
                </div>
                <div class='col-12'>
                    <label class='subheader'>Point Colour</label>
                    <TablerInput type='color' v-model='feat.properties.color'/>
                </div>
            </template>
            <template v-else-if='feat.geometry.type !== "Point"'>
                <div class='col-12'>
                    <label class='subheader'>Line Colour</label>
                    <TablerInput type='color' v-model='feat.properties.stroke'/>
                </div>

                <div class='col-12'>
                    <label class='subheader'>Line Style</label>
                    <TablerEnum v-model='feat.properties["stroke-style"]' :options='["Solid", "Dashed", "Dotted", "Outlined"]'/>
                </div>
                <div class='col-12'>
                    <label class='subheader'>Line Thickness</label>
                    <TablerRange v-model='feat.properties["stroke-width"]' :min="1" :max="6" :step="1"/>
                </div>
                <div class='col-12'>
                    <label class='subheader'>Line Opacity</label>
                    <TablerRange v-model='feat.properties["stroke-opacity"]' :min='0' :max='1' :step='0.1'/>
                </div>
            </template>
            <template v-if='feat.geometry.type === "Polygon"'>
                <div class='col-12'>
                    <label class='subheader'>Fill Colour</label>
                    <TablerInput type='color' v-model='feat.properties.fill'/>
                </div>
                <div class='col-12 round'>
                    <label class='subheader'>Fill Opacity</label>
                    <TablerRange v-model='feat.properties["fill-opacity"]' :min='0' :max='1' :step='0.1'/>
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
    TablerToggle,
    TablerEnum
} from '@tak-ps/vue-tabler';

export default {
    name: 'CoTStyle',
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
    },
    methods: {
        format: function() {
            this.$emit('update:modelValue', res);
        }
    },
    components: {
        TablerToggle,
        TablerRange,
        TablerEnum,
        TablerInput,
        IconSelect,
    }
}
</script>

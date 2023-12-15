<template>
<div class='card-body'>
    <div class='row g-2'>
        <template v-if='feat.geometry.type === "Point"'>
            <div class='col-md-12 darken round'>
                <IconSelect label='Point Icon' v-model='feat.properties.icon'/>
            </div>
            <div class='col-md-12 darken round'>
                <TablerColour label='Point Color' v-model='feat.properties.color'/>
            </div>
        </template>
        <template v-else-if='feat.geometry.type !== "Point"'>
            <div class='col-md-12 darken round'>
                <TablerColour label='Line Color' v-model='feat.properties.stroke'/>
            </div>

            <div class='col-md-12 darken round'>
                <TablerEnum label='Line Style' v-model='feat.properties["stroke-style"]' :options='["Solid", "Dashed", "Dotted", "Outlined"]'/>
            </div>
            <div class='col-md-12 darken round'>
                <TablerRange label='Line Thickness' v-model='feat.properties["stroke-width"]' :min="1" :max="6" :step="1"/>
            </div>
            <div class='col-md-12 darken round'>
                <TablerRange label='Line Opacity' v-model='feat.properties["stroke-opacity"]' :min='0' :max='1' :step='0.1'/>
            </div>
        </template>
        <template v-if='feat.geometry.type === "Polygon"'>
            <div class='col-md-12 darken round'>
                <TablerColour label='Fill Color' v-model='feat.properties.fill'/>
            </div>
            <div class='col-md-12 darken round'>
                <TablerRange label='Fill Opacity' v-model='feat.properties["fill-opacity"]' :min='0' :max='1' :step='0.1'/>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import IconSelect from '../../util/IconSelect.vue';
import {
    TablerRange,
    TablerColour,
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
            point: {
                icon: '',
                color: '#d63939',
            },
            line: {
                stroke: '#d63939',
                'stroke-style': 'solid',
                'stroke-opacity': 256,
                'stroke-width': 3,
            },
            polygon: {
                stroke: '#d63939',
                'stroke-style': 'solid',
                'stroke-opacity': 256,
                'stroke-width': 3,
                'fill': '#d63939',
                'fill-opacity': 256,
            }
        };
    },
    mounted: function() {
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
        TablerColour,
        IconSelect,
    }
}
</script>

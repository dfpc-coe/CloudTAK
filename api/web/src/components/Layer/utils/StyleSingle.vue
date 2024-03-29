<template>
<div class='card-body'>
    <div class='row g-2'>
        <div class="d-flex justify-content-center">
            <div class="btn-list">
                <div class="btn-group" role="group">
                    <input v-model='mode' type="radio" class="btn-check" name="geom-toolbar" value='point'>
                    <label @click='mode="point"' class="btn btn-icon px-3">
                        <IconPoint size='32'/> Points
                    </label>
                    <input v-model='mode' type="radio" class="btn-check" name="geom-toolbar" value='line'>
                    <label @click='mode="line"' class="btn btn-icon px-3">
                        <IconLine size='32'/> Lines
                    </label>
                    <input v-model='mode' type="radio" class="btn-check" name="geom-toolbar" value='polygon'>
                    <label @click='mode="polygon"' class="btn btn-icon px-3">
                        <IconPolygon size='32'/> Polygons
                    </label>
                </div>
            </div>
        </div>

        <div class='col-md-12 darken round'>
            <StyleTemplate
                :disabled='disabled'
                :schema='schema'
                v-model='filters[mode].properties.callsign'
                label='Callsign'
            />
        </div>

        <div class='col-md-12 darken round'>
            <StyleTemplate
                :disabled='disabled'
                :schema='schema'
                v-model='filters[mode].properties.remarks'
                label='Remarks'
            />
        </div>

        <template v-if='mode === "point"'>
            <div class='col-md-12 darken round'>
                <IconSelect label='Point Icon' v-model='filters[mode].properties.icon' :disabled='disabled || !filters[mode].enabled.icon'>
                    <TablerToggle v-model='filters[mode].enabled.icon' :disabled='disabled' label='Enabled'/>
                </IconSelect>
            </div>
            <div class='col-md-12 darken round'>
                <TablerColour label='Point Color' v-model='filters[mode].properties.color' :disabled='disabled || !filters[mode].enabled.color'>
                    <TablerToggle v-model='filters[mode].enabled.color' :disabled='disabled' label='Enabled'/>
                </TablerColour>
            </div>
        </template>
        <template v-else-if='mode !== "point"'>
            <div class='col-md-12 darken round'>
                <TablerColour label='Line Color' v-model='filters[mode].properties.stroke' :disabled='disabled || !filters[mode].enabled.stroke'>
                    <TablerToggle v-model='filters[mode].enabled.stroke' :disabled='disabled' label='Enabled'/>
                </TablerColour>
            </div>

            <div class='col-md-12 darken round'>
                <TablerEnum label='Line Style' :disabled='disabled || !filters[mode].enabled["stroke-style"]' v-model='filters[mode].properties["stroke-style"]' :options='["Solid", "Dashed", "Dotted", "Outlined"]'>
                    <TablerToggle v-model='filters[mode].enabled["stroke-style"]' :disabled='disabled' label='Enabled'/>
                </TablerEnum>
            </div>
            <div class='col-md-12 darken round'>
                <TablerRange label='Line Thickness' :disabled='disabled || !filters[mode].enabled["stroke-width"]' v-model='filters[mode].properties["stroke-width"]' :min="1" :max="6" :step="1">
                    <TablerToggle v-model='filters[mode].enabled["stroke-width"]' :disabled='disabled' label='Enabled'/>
                </TablerRange>
            </div>
            <div class='col-md-12 darken round'>
                <TablerRange label='Line Opacity' :disabled='disabled || !filters[mode].enabled["stroke-opacity"]' v-model='filters[mode].properties["stroke-opacity"]' :min="0" :max="256" :step="1">
                    <TablerToggle v-model='filters[mode].enabled["stroke-opacity"]' :disabled='disabled' label='Enabled'/>
                </TablerRange>
            </div>
        </template>
        <template v-if='mode === "polygon"'>
            <div class='col-md-12 darken round'>
                <TablerColour label='Fill Color' v-model='filters[mode].properties.fill' :disabled='disabled || !filters[mode].enabled.fill'>
                    <TablerToggle v-model='filters[mode].enabled.fill' :disabled='disabled' label='Enabled'/>
                </TablerColour>
            </div>
            <div class='col-md-12 darken round'>
                <TablerRange label='Fill Opacity' :disabled='disabled' v-model='filters[mode].properties["fill-opacity"]' :min="0" :max="256" :step="1">
                    <TablerToggle v-model='filters[mode].enabled["fill-opacity"]' :disabled='disabled' label='Enabled'/>
                </TablerRange>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import StyleTemplate from './StyleTemplate.vue';
import {
    IconPoint,
    IconLine,
    IconPolygon,
} from '@tabler/icons-vue'
import IconSelect from '../../util/IconSelect.vue';
import {
    TablerRange,
    TablerColour,
    TablerToggle,
    TablerEnum
} from '@tak-ps/vue-tabler';

export default {
    name: 'StyleSingle',
    props: {
        modelValue: {
            type: Object,
            default: function() {
                return {};
            },
            required: true
        },
        schema: {
            type: Object,
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            mode: 'point',
            filters: {
                point: {
                    enabled: {
                        icon: false,
                        color: false,
                        remarks: false,
                        callsign: false
                    },
                    properties: {
                        icon: '',
                        color: '#d63939',
                        remarks: '',
                        callsign: ''
                    }
                },
                line: {
                    enabled: {
                        stroke: false,
                        'stroke-style': false,
                        'stroke-opacity': false,
                        'stroke-width': false,
                        remarks: false,
                        callsign: false
                    },
                    properties: {
                        stroke: '#d63939',
                        'stroke-style': 'solid',
                        'stroke-opacity': 256,
                        'stroke-width': 3,
                        remarks: '',
                        callsign: ''
                    }
                },
                polygon: {
                    enabled: {
                        stroke: false,
                        'stroke-style': false,
                        'stroke-opacity': false,
                        'stroke-width': false,
                        fill: false,
                        'fill-opacity': false,
                        remarks: false,
                        callsign: false
                    },
                    properties: {
                        stroke: '#d63939',
                        'stroke-style': 'solid',
                        'stroke-opacity': 256,
                        'stroke-width': 3,
                        'fill': '#d63939',
                        'fill-opacity': 256,
                        remarks: '',
                        callsign: ''
                    }
                }
            }
        };
    },
    watch: {
        filters: {
            deep: true,
            handler: function() {
                this.format();
            }
        }
    },
    mounted: function() {
        for (const key in this.modelValue) {
            for (const prop in this.modelValue[key]) {
                if (this.modelValue[key][prop] !== undefined) {
                    this.filters[key].enabled[prop] = true;
                }
            }

            const style = JSON.parse(JSON.stringify(this.modelValue[key]));
            Object.assign(this.filters[key].properties, style);
        }

        this.format();
    },
    methods: {
        format: function() {
            const styles = JSON.parse(JSON.stringify(this.filters));

            const res = {};

            for (const geom in styles) {
                res[geom] = {};
                for (const key in styles[geom].properties) {
                    if (!['remarks', 'callsign'].includes(key) && !styles[geom].enabled[key]) continue;

                    if (['fill-opacity', 'stroke-width', 'stroke-opacity'].includes(key)) {
                        if (res[geom][key] !== undefined) res[geom][key] = parseInt(res[geom][key])
                    } else if (['remarks', 'callsign'].includes(key)) {
                        if (styles[geom].properties[key]) res[geom][key] = styles[geom].properties[key];
                    } else {
                        res[geom][key] = styles[geom].properties[key];
                    }
                }

            }

            this.$emit('update:modelValue', res);
        }
    },
    components: {
        IconPoint,
        IconLine,
        IconPolygon,
        TablerToggle,
        TablerRange,
        TablerEnum,
        TablerColour,
        StyleTemplate,
        IconSelect,
    }
}
</script>

<style lang="scss">
.darken:hover {
  background-color: #F5F5F5;
}
</style>

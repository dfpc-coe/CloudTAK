<template>
<div class='card-body'>
    <div class='row g-2'>
        <div class="d-flex justify-content-center">
            <div class="btn-list">
                <div class="btn-group" role="group">
                    <input v-model='mode' type="radio" class="btn-check" name="geom-toolbar" value='point'>
                    <label @click='mode="point"' class="btn btn-icon px-3">
                        <PointIcon/> Points
                    </label>
                    <input v-model='mode' type="radio" class="btn-check" name="geom-toolbar" value='line'>
                    <label @click='mode="line"' class="btn btn-icon px-3">
                        <LineIcon/> Lines
                    </label>
                    <input v-model='mode' type="radio" class="btn-check" name="geom-toolbar" value='polygon'>
                    <label @click='mode="polygon"' class="btn btn-icon px-3">
                        <PolygonIcon/> Polygons
                    </label>
                </div>
            </div>
        </div>

        <div v-if='filters[mode].properties.color !== undefined' class='col-md-12'>
            <label class="form-label">Point Color</label>
            <div class="row g-2">
                <div :key='color' v-for='color in [
                    "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                ]'
                class="col-auto">
                    <label class="form-colorinput">
                        <input :disabled='disabled' v-model='filters[mode].properties.color' :value='color' type="radio" class="form-colorinput-input">
                        <span class="form-colorinput-color bg-dark" :class='[
                            `bg-${color}`
                        ]'></span>
                    </label>
                </div>
            </div>
        </div>

        <div v-if='filters[mode].properties.stroke !== undefined' class='col-md-12'>
            <label class="form-label">Line Color</label>
            <div class="row g-2">
                <div :key='color' v-for='color in [
                    "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                ]'
                class="col-auto">
                    <label class="form-colorinput">
                        <input :disabled='disabled' v-model='filters[mode].properties.stroke' :value='color' type="radio" class="form-colorinput-input">
                        <span class="form-colorinput-color bg-dark" :class='[
                            `bg-${color}`
                        ]'></span>
                    </label>
                </div>
            </div>
        </div>

        <div v-if='filters[mode].properties["stroke-style"] !== undefined' class='col-md-12'>
            <TablerEnum label='Line Style' :disabled='disabled || !filters[mode].enabled["stroke-style"]' v-model='filters[mode].properties["stroke-style"]' :options='["Solid", "Dashed", "Dotted", "Outlined"]'>
                <TablerToggle v-model='filters[mode].enabled["stroke-style"]' label='Enabled'/>
            </TablerEnum>
        </div>
        <div v-if='filters[mode].properties["stroke-width"] !== undefined' class='col-md-12'>
            <TablerRange label='Line Thickness' :disabled='disabled || !filters[mode].enabled["stroke-width"]' v-model='filters[mode].properties["stroke-width"]' :min="1" :max="6" :step="1">
                <TablerToggle v-model='filters[mode].enabled["stroke-width"]' label='Enabled'/>
            </TablerRange>
        </div>
        <div v-if='filters[mode].properties["stroke-opacity"] !== undefined' class='col-md-12'>
            <TablerRange label='Line Opacity' :disabled='disabled || !filters[mode].enabled["stroke-opacity"]' v-model='filters[mode].properties["stroke-opacity"]' :min="0" :max="256" :step="1">
                <TablerToggle v-model='filters[mode].enabled["stroke-opacity"]' label='Enabled'/>
            </TablerRange>
        </div>

        <div v-if='filters[mode].properties.fill !== undefined' class='col-md-12'>
            <label class="form-label">Fill Color</label>
            <div class="row g-2">
                <div :key='color' v-for='color in [
                    "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                ]'
                class="col-auto">
                    <label class="form-colorinput">
                        <input :disabled='disabled' v-model='filters[mode].properties.fill' :value='color' type="radio" class="form-colorinput-input">
                        <span class="form-colorinput-color bg-dark" :class='[
                            `bg-${color}`
                        ]'></span>
                    </label>
                </div>
            </div>
        </div>
        <div v-if='filters[mode].properties["fill-opacity"] !== undefined' class='col-md-12'>
            <TablerRange label='Fill Opacity' :disabled='disabled' v-model='filters[mode].properties["fill-opacity"]' :min="0" :max="256" :step="1"/>
        </div>

        <div class='col-md-12'>
            <StyleTemplate
                :disabled='disabled'
                :schema='schema'
                v-model='filters[mode].properties.callsign'
                label='Callsign'
            />
        </div>

        <div class='col-md-12'>
            <StyleTemplate
                :disabled='disabled'
                :schema='schema'
                v-model='filters[mode].properties.remarks'
                label='Remarks'
            />
        </div>
    </div>
</div>
</template>

<script>
import StyleTemplate from './StyleTemplate.vue';
import {
    PointIcon,
    LineIcon,
    PolygonIcon,
} from 'vue-tabler-icons'
import {
    TablerRange,
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
                        color: false,
                        remarks: false,
                        callsign: false
                    },
                    properties: {
                        color: 'red',
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
                        stroke: 'red',
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
                        stroke: 'red',
                        'stroke-style': 'solid',
                        'stroke-opacity': 256,
                        'stroke-width': 3,
                        'fill': 'red',
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
            const style = JSON.parse(JSON.stringify(this.modelValue[key]));

            const colors = {
                '#1d273b': 'dark',
                '#ffffff': 'white',
                '#206bc4': 'blue',
                '#4299e1': 'azure',
                '#4263eb': 'indigo',
                '#ae3ec9': 'purple',
                '#d6336c': 'pink',
                '#d63939': 'red',
                '#f76707': 'orange',
                '#f59f00': 'yellow',
                '#74b816': 'lime'
            };

            for (const color of ['color', 'stroke', 'fill']) {
                if (style[color]) style[color] = colors[style[color]];
            }

            Object.assign(this.filters[key], style);
        }

        this.format();
    },
    methods: {
        format: function() {
            const styles = JSON.parse(JSON.stringify(this.filters));
            if (styles) {
                const colors = {
                    dark: '#1d273b',
                    white: '#ffffff',
                    blue: '#206bc4',
                    azure: '#4299e1',
                    indigo: '#4263eb',
                    purple: '#ae3ec9',
                    pink: '#d6336c',
                    red: '#d63939',
                    orange: '#f76707',
                    yellow: '#f59f00',
                    lime: '#74b816'
                };

                for (const key in styles) {
                    for (const intkey of ['fill-opacity', 'stroke-width', 'stroke-opacity']) {
                        if (styles[key][intkey]) styles[key][intkey] = parseInt(styles[key][intkey])
                    }

                    for (const color of ['color', 'stroke', 'fill']) {
                        if (styles[key][color]) {
                            styles[key][color] = colors[styles[key][color]];
                        }
                    }
                }
            }

            this.$emit('update:modelValue', styles);
        }
    },
    components: {
        PointIcon,
        LineIcon,
        PolygonIcon,
        TablerToggle,
        TablerRange,
        TablerEnum,
        StyleTemplate,
    }
}
</script>

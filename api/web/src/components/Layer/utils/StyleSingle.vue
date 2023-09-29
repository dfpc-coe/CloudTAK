<template>
<div class='card-body'>
    <div class='row g-2'>
        <div class="d-flex justify-content-center mb-4">
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

        <div v-if='filters[mode].color !== undefined' class='col-md-12 mb-3'>
            <label class="form-label">Point Color</label>
            <div class="row g-2">
                <div :key='color' v-for='color in [
                    "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                ]'
                class="col-auto">
                    <label class="form-colorinput">
                        <input :disabled='disabled' v-model='filters[mode].color' :value='color' type="radio" class="form-colorinput-input">
                        <span class="form-colorinput-color bg-dark" :class='[
                            `bg-${color}`
                        ]'></span>
                    </label>
                </div>
            </div>
        </div>

        <div v-if='filters[mode].stroke !== undefined' class='col-md-12 mb-3'>
            <label class="form-label">Line Color</label>
            <div class="row g-2">
                <div :key='color' v-for='color in [
                    "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                ]'
                class="col-auto">
                    <label class="form-colorinput">
                        <input :disabled='disabled' v-model='filters[mode].stroke' :value='color' type="radio" class="form-colorinput-input">
                        <span class="form-colorinput-color bg-dark" :class='[
                            `bg-${color}`
                        ]'></span>
                    </label>
                </div>
            </div>
        </div>

        <div v-if='filters[mode]["stroke-style"] !== undefined' class='col-md-12 mb-3'>
            <label class="form-label">Line Style</label>
            <select :disabled='disabled' v-model='filters[mode]["stroke-style"]' class="form-select">
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="outlined">Outlined</option>
            </select>
        </div>
        <div v-if='filters[mode]["stroke-width"] !== undefined' class='col-md-12 mb-3'>
            <label class="form-label">Line Thickness</label>
            <input :disabled='disabled' v-model='filters[mode]["stroke-width"]' type="range" class="form-range mb-2" min="1" max="6" step="1">
        </div>
        <div v-if='filters[mode]["stroke-opacity"] !== undefined' class='col-md-12 mb-3'>
            <label class="form-label">Line Opacity</label>
            <input :disabled='disabled' v-model='filters[mode]["stroke-opacity"]' type="range" class="form-range mb-2" min="0" max="256" step="1">
        </div>

        <div v-if='filters[mode].fill !== undefined' class='col-md-12 mb-3'>
            <label class="form-label">Fill Color</label>
            <div class="row g-2">
                <div :key='color' v-for='color in [
                    "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                ]'
                class="col-auto">
                    <label class="form-colorinput">
                        <input :disabled='disabled' v-model='filters[mode].fill' :value='color' type="radio" class="form-colorinput-input">
                        <span class="form-colorinput-color bg-dark" :class='[
                            `bg-${color}`
                        ]'></span>
                    </label>
                </div>
            </div>
        </div>
        <div v-if='filters[mode]["fill-opacity"] !== undefined' class='col-md-12 mb-3'>
            <label class="form-label">Fill Opacity</label>
            <input :disabled='disabled' v-model='filters[mode]["fill-opacity"]' type="range" class="form-range mb-2" min="0" max="256" step="1">
        </div>

        <div class='col-md-12'>
            <StyleTemplate
                :disabled='disabled'
                :schema='schema'
                v-model='filters[mode].callsign'
                label='Callsign'
            />
        </div>

        <div class='col-md-12'>
            <StyleTemplate
                :disabled='disabled'
                :schema='schema'
                v-model='filters[mode].remarks'
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
                    color: 'red',
                    remarks: '',
                    callsign: ''
                },
                line: {
                    stroke: 'red',
                    'stroke-style': 'solid',
                    'stroke-opacity': 256,
                    'stroke-width': 3,
                    remarks: '',
                    callsign: ''
                },
                polygon: {
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
        StyleTemplate,
    }
}
</script>

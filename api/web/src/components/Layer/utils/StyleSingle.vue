<template>
<div class='row g-2'>
    <div class='col-md-12 hover-light rounded px-2 py-2'>
        <StyleTemplate
            label='Global Callsign'
            description='Global Callsign will apply to all CoT markers unless they are overriden by a callsign field on a given query'
            :disabled='disabled'
            :schema='schema'
            v-model='filters.callsign'
        />
    </div>

    <div class='col-md-12 hover-light rounded px-2 py-2'>
        <StyleTemplate
            label='Global Remarks'
            description='Global Remarks will apply to all CoT markers unless they are overriden by a remarks field on a given query'
            :disabled='disabled'
            :schema='schema'
            v-model='filters.remarks'
        />
    </div>

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

    <div class='col-md-12 hover-light rounded px-2 py-2'>
        <div class='col-12 d-flex align-items-center'>
            <label>Callsign Override</label>
            <div class='ms-auto'>
                <TablerToggle v-model='filters[mode].enabled.callsign' :disabled='disabled' label='Enabled'/>
            </div>
        </div>

        <StyleTemplate
            v-if='filters[mode].enabled.callsign'
            :disabled='disabled'
            :schema='schema'
            v-model='filters[mode].properties.callsign'
        />
    </div>

    <div class='col-md-12 hover-light rounded px-2 py-2'>
        <div class='col-12 d-flex align-items-center'>
            <label>Remarks Override</label>
            <div class='ms-auto'>
                <TablerToggle v-model='filters[mode].enabled.remarks' :disabled='disabled' label='Enabled'/>
            </div>
        </div>

        <StyleTemplate
            v-if='filters[mode].enabled.remarks'
            :disabled='disabled'
            :schema='schema'
            v-model='filters[mode].properties.remarks'
        />
    </div>

    <template v-if='mode === "point"'>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label>Point Icon</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled.icon' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <IconSelect v-if='filters[mode].enabled.icon' v-model='filters[mode].properties.icon' :disabled='disabled || !filters[mode].enabled.icon'/>
        </div>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label>Point Color</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled.color' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <TablerColour v-if='filters[mode].enabled.color' v-model='filters[mode].properties.color' :disabled='disabled || !filters[mode].enabled.color'/>
        </div>
    </template>
    <template v-else-if='mode !== "point"'>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label>Line Color</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled.stroke' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <TablerColour v-if='filters[mode].enabled.stroke' v-model='filters[mode].properties.stroke' :disabled='disabled || !filters[mode].enabled.stroke'/>
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label>Line Style</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled["stroke-style"]' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <TablerEnum v-if='filters[mode].enabled["stroke-style"]' :disabled='disabled || !filters[mode].enabled["stroke-style"]' v-model='filters[mode].properties["stroke-style"]' :options='["Solid", "Dashed", "Dotted", "Outlined"]'/>
        </div>
        <div class='col-md-12 hover-light round'>
            <div class='col-12 d-flex align-items-center'>
                <label>Line Width</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled["stroke-width"]' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <TablerRange v-if='filters[mode].enabled["stroke-width"]' :disabled='disabled || !filters[mode].enabled["stroke-width"]' v-model='filters[mode].properties["stroke-width"]' :min="1" :max="6" :step="1"/>
        </div>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label>Line Opacity</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled["stroke-opacity"]' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <TablerRange v-if='filters[mode].enabled["stroke-opacity"]' :disabled='disabled || !filters[mode].enabled["stroke-opacity"]' v-model='filters[mode].properties["stroke-opacity"]' :min="0" :max="256" :step="1"/>
        </div>
    </template>
    <template v-if='mode === "polygon"'>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label>Fill Color</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled.fill' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <TablerColour v-if='filters[mode].enabled.fill' v-model='filters[mode].properties.fill' :disabled='disabled || !filters[mode].enabled.fill'/>
        </div>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label>Fill Opacity</label>
                <div class='ms-auto'>
                    <TablerToggle v-model='filters[mode].enabled["fill-opacity"]' :disabled='disabled' label='Enabled'/>
                </div>
            </div>
            <TablerRange v-if='filters[mode].enabled["fill-opacity"]' :disabled='disabled' v-model='filters[mode].properties["fill-opacity"]' :min="0" :max="256" :step="1"/>
        </div>
    </template>
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
                callsign: '',
                remarks: '',
                links: [],
                point: {
                    enabled: {
                        icon: false,
                        links: false,
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
                        links: false,
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
                        links: false,
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
        for (const prop of ['remarks', 'callsign', 'links']) {
            if (!this.modelValue[prop]) continue;
            this.filters[prop] = this.modelValue[prop];
        }

        for (const key of ['point', 'line', 'polygon']) {
            if (!this.modelValue[key]) continue;
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

            for (const prop of ['remarks', 'callsign', 'links']) {
                res[prop] = styles[prop];
            }

            for (const geom of ['point', 'line', 'polygon']) {
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

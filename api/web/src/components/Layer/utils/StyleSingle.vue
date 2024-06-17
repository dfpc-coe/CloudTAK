<template>
    <div class='row g-2'>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <StyleTemplate
                v-model='filters.callsign'
                label='Global Callsign'
                description='Global Callsign will apply to all CoT markers unless they are overriden by a callsign field on a given query'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <StyleTemplate
                v-model='filters.remarks'
                label='Global Remarks'
                description='Global Remarks will apply to all CoT markers unless they are overriden by a remarks field on a given query'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <StyleLinks
                v-model='filters.links'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='d-flex justify-content-center'>
            <div class='btn-list'>
                <div
                    class='btn-group'
                    role='group'
                >
                    <input
                        v-model='mode'
                        type='radio'
                        class='btn-check'
                        name='geom-toolbar'
                        value='point'
                    >
                    <label
                        class='btn btn-icon px-3'
                        @click='mode="point"'
                    >
                        <IconPoint size='32' /> Points
                    </label>
                    <input
                        v-model='mode'
                        type='radio'
                        class='btn-check'
                        name='geom-toolbar'
                        value='line'
                    >
                    <label
                        class='btn btn-icon px-3'
                        @click='mode="line"'
                    >
                        <IconLine size='32' /> Lines
                    </label>
                    <input
                        v-model='mode'
                        type='radio'
                        class='btn-check'
                        name='geom-toolbar'
                        value='polygon'
                    >
                    <label
                        class='btn btn-icon px-3'
                        @click='mode="polygon"'
                    >
                        <IconPolygon size='32' /> Polygons
                    </label>
                </div>
            </div>
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconBlockquote size='20' /> Callsign Override</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.callsign'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleTemplate
                v-if='filters[mode].enabled.callsign'
                v-model='filters[mode].properties.callsign'
                placeholder='Callsign Override'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconBlockquote size='20' /> Remarks Override</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.remarks'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleTemplate
                v-if='filters[mode].enabled.remarks'
                v-model='filters[mode].properties.remarks'
                placeholder='Remarks Override'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconLink size='20' /> Links Override</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.links'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleLinks
                v-if='filters[mode].enabled.links'
                v-model='filters[mode].properties.links'
                :label='""'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <template v-if='mode === "point"'>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label><IconPhoto size='20' /> Point Icon</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled.icon'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <IconSelect
                    v-if='filters[mode].enabled.icon'
                    v-model='filters[mode].properties.icon'
                    label=''
                    :disabled='disabled || !filters[mode].enabled.icon'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label><IconPaint size='20' /> Point Color</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled["marker-color"]'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerColour
                    v-if='filters[mode].enabled["marker-color"]'
                    v-model='filters[mode].properties["marker-color"]'
                    :disabled='disabled || !filters[mode].enabled["marker-color"]'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label>
                        <IconGhost size='20'/>
                        Point Opacity
                    </label>
                    <span class='mx-2' v-text='`(${Math.round(filters[mode].properties["marker-opacity"] * 100)}%)`'/>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled["marker-opacity"]'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerRange
                    v-if='filters[mode].enabled["marker-opacity"]'
                    v-model='filters[mode].properties["marker-opacity"]'
                    :disabled='disabled'
                    :min='0'
                    :max='1'
                    :step='0.01'
                />
            </div>
        </template>
        <template v-else-if='mode !== "point"'>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <div><IconPaint size='20' /> Line Color</div>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled.stroke'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerColour
                    v-if='filters[mode].enabled.stroke'
                    v-model='filters[mode].properties.stroke'
                    :disabled='disabled || !filters[mode].enabled.stroke'
                />
            </div>

            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label><IconBorderStyle2 size='20' /> Line Style</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled["stroke-style"]'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerEnum
                    v-if='filters[mode].enabled["stroke-style"]'
                    v-model='filters[mode].properties["stroke-style"]'
                    :disabled='disabled || !filters[mode].enabled["stroke-style"]'
                    :options='["Solid", "Dashed", "Dotted", "Outlined"]'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label><IconRuler2 size='20' /> Line Width</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled["stroke-width"]'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerRange
                    v-if='filters[mode].enabled["stroke-width"]'
                    v-model='filters[mode].properties["stroke-width"]'
                    :disabled='disabled || !filters[mode].enabled["stroke-width"]'
                    :min='1'
                    :max='6'
                    :step='1'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label>
                        <IconGhost size='20' />
                        Line Opacity
                    </label>
                    <span class='mx-2' v-text='`(${Math.round(filters[mode].properties["stroke-opacity"] * 100)}%)`'/>
                    <div class='d-flex align-items-center ms-auto btn-list'>
                        <TablerToggle
                            v-model='filters[mode].enabled["stroke-opacity"]'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerRange
                    v-if='filters[mode].enabled["stroke-opacity"]'
                    v-model='filters[mode].properties["stroke-opacity"]'
                    :disabled='disabled || !filters[mode].enabled["stroke-opacity"]'
                    :min='0'
                    :max='1'
                    :step='0.01'
                />
            </div>
        </template>
        <template v-if='mode === "polygon"'>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label><IconPaint size='20' /> Fill Color</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled.fill'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerColour
                    v-if='filters[mode].enabled.fill'
                    v-model='filters[mode].properties.fill'
                    :disabled='disabled || !filters[mode].enabled.fill'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label>
                        <IconGhost size='20'/>
                        Fill Opacity
                    </label>
                    <span class='mx-2' v-text='`(${Math.round(filters[mode].properties["fill-opacity"] * 100)}%)`'/>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled["fill-opacity"]'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerRange
                    v-if='filters[mode].enabled["fill-opacity"]'
                    v-model='filters[mode].properties["fill-opacity"]'
                    :disabled='disabled'
                    :min='0'
                    :max='1'
                    :step='0.01'
                />
            </div>
        </template>
    </div>
</template>

<script>
import StyleTemplate from './StyleTemplate.vue';
import {
    IconLink,
    IconPaint,
    IconGhost,
    IconPoint,
    IconPhoto,
    IconLine,
    IconPolygon,
    IconBorderStyle2,
    IconBlockquote,
    IconRuler2,
} from '@tabler/icons-vue'
import IconSelect from '../../util/IconSelect.vue';
import StyleLinks from './StyleLinks.vue';
import {
    TablerRange,
    TablerColour,
    TablerToggle,
    TablerEnum
} from '@tak-ps/vue-tabler';

export default {
    name: 'StyleSingle',
    components: {
        IconRuler2,
        IconGhost,
        IconPaint,
        IconPoint,
        IconLine,
        IconPolygon,
        IconPhoto,
        IconLink,
        IconBlockquote,
        IconBorderStyle2,
        TablerToggle,
        TablerRange,
        TablerEnum,
        TablerColour,
        StyleTemplate,
        StyleLinks,
        IconSelect,
    },
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
    emits: [
        'update:modelValue'
    ],
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
                        'marker-color': false,
                        'marker-opacity': false,
                        remarks: false,
                        callsign: false
                    },
                    properties: {
                        icon: '',
                        'marker-color': '#d63939',
                        'marker-opacity': 1,
                        remarks: '',
                        callsign: '',
                        links: []
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
                        'stroke-opacity': 1,
                        'stroke-width': 3,
                        remarks: '',
                        callsign: '',
                        links: []
                    }
                },
                polygon: {
                    enabled: {
                        stroke: false,
                        'stroke-style': false,
                        'stroke-opacity': false,
                        'stroke-width': false,
                        fill: false,
                        links: false,
                        'fill-opacity': false,
                        remarks: false,
                        callsign: false,
                    },
                    properties: {
                        stroke: '#d63939',
                        'stroke-style': 'solid',
                        'stroke-opacity': 1,
                        'stroke-width': 3,
                        'fill': '#d63939',
                        'fill-opacity': 1,
                        remarks: '',
                        callsign: '',
                        links: []
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
                for (const key in styles[geom].enabled) {
                    if (!styles[geom].enabled[key]) continue;

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
    }
}
</script>

<template>
    <div class='row g-2'>
        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconLicense
                    :size='20'
                    stroke='1'
                /> Global ID</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.id'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleTemplate
                v-if='enabled.id'
                v-model='filters.id'
                :rows='1'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconBlockquote
                    :size='20'
                    stroke='1'
                /> Global Callsign</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.callsign'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleTemplate
                v-if='enabled.callsign'
                v-model='filters.callsign'
                :rows='1'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconBlockquote
                    :size='20'
                    stroke='1'
                /> Global Remarks</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.remarks'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleTemplate
                v-if='enabled.remarks'
                v-model='filters.remarks'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconLink
                    :size='20'
                    stroke='1'
                /> Global Links</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.links'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleLinks
                v-if='enabled.links'
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
                        <IconPoint
                            :size='32'
                            stroke='1'
                        /> Points
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
                        <IconLine
                            :size='32'
                            stroke='1'
                        /> Lines
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
                        <IconPolygon
                            :size='32'
                            stroke='1'
                        /> Polygons
                    </label>
                </div>
            </div>
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconLicense
                    :size='20'
                    stroke='1'
                /> ID Override</label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.id'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>

            <StyleTemplate
                v-if='filters[mode].enabled.id'
                v-model='filters[mode].properties.id'
                placeholder='ID Override'
                :disabled='disabled'
                :schema='schema'
            />
        </div>

        <div class='col-md-12 hover-light rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label><IconBlockquote
                    :size='20'
                    stroke='1'
                /> Callsign Override</label>
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
                <label><IconBlockquote
                    :size='20'
                    stroke='1'
                /> Remarks Override</label>
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
                <label><IconLink
                    :size='20'
                    stroke='1'
                /> Links Override</label>
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
                    <label><IconCategory
                        :size='20'
                        stroke='1'
                    /> Point Type</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled.type'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <StyleTemplate
                    v-if='filters[mode].enabled.type'
                    v-model='filters[mode].properties.type'
                    placeholder='Type Override (a-f-G)'
                    :disabled='disabled'
                    :rows='1'
                    :schema='schema'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label><IconPhoto
                        :size='20'
                        stroke='1'
                    /> Point Icon</label>
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
                    <label><IconPaint
                        :size='20'
                        stroke='1'
                    /> Point Color</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled["marker-color"]'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerInput
                    v-if='filters[mode].enabled["marker-color"]'
                    v-model='filters[mode].properties["marker-color"]'
                    type='color'
                    :disabled='disabled || !filters[mode].enabled["marker-color"]'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label>
                        <IconGhost
                            :size='20'
                            stroke='1'
                        />
                        Point Opacity
                    </label>
                    <span
                        v-if='filters[mode].enabled["marker-opacity"]'
                        class='mx-2'
                        v-text='`(${Math.round(filters[mode].properties["marker-opacity"] * 100)}%)`'
                    />
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
                    <div>
                        <IconPaint
                            :size='20'
                            stroke='1'
                        /> Line Color
                    </div>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled.stroke'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerInput
                    v-if='filters[mode].enabled.stroke'
                    v-model='filters[mode].properties.stroke'
                    type='color'
                    :disabled='disabled || !filters[mode].enabled.stroke'
                />
            </div>

            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label><IconBorderStyle2
                        :size='20'
                        stroke='1'
                    /> Line Style</label>
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
                    <label><IconRuler2
                        :size='20'
                        stroke='1'
                    /> Line Width</label>
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
                        <IconGhost
                            :size='20'
                            stroke='1'
                        />
                        Line Opacity
                    </label>
                    <span
                        v-if='filters[mode].enabled["stroke-opacity"]'
                        class='mx-2'
                        v-text='`(${Math.round(filters[mode].properties["stroke-opacity"] * 100)}%)`'
                    />
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
                    <label><IconPaint
                        :size='20'
                        stroke='1'
                    /> Fill Color</label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled.fill'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <TablerInput
                    v-if='filters[mode].enabled.fill'
                    v-model='filters[mode].properties.fill'
                    type='color'
                    :disabled='disabled || !filters[mode].enabled.fill'
                />
            </div>
            <div class='col-md-12 hover-light rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label>
                        <IconGhost
                            :size='20'
                            stroke='1'
                        />
                        Fill Opacity
                    </label>
                    <span
                        v-if='filters[mode].enabled["fill-opacity"]'
                        class='mx-2'
                        v-text='`(${Math.round(filters[mode].properties["fill-opacity"] * 100)}%)`'
                    />
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
    IconCategory,
    IconBorderStyle2,
    IconBlockquote,
    IconRuler2,
    IconLicense,
} from '@tabler/icons-vue'
import IconSelect from '../../util/IconSelect.vue';
import StyleLinks from './StyleLinks.vue';
import {
    TablerRange,
    TablerInput,
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
        IconCategory,
        IconSelect,
        IconLicense,
        TablerToggle,
        TablerRange,
        TablerEnum,
        TablerInput,
        StyleTemplate,
        StyleLinks,
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
            enabled: {
                id: false,
                remarks: false,
                callsign: false,
                links: false,
            },
            filters: {
                id: '',
                callsign: '',
                remarks: '',
                links: [],
                point: {
                    enabled: {
                        id: false,
                        icon: false,
                        links: false,
                        'marker-color': false,
                        'marker-opacity': false,
                        remarks: false,
                        callsign: false
                    },
                    properties: {
                        id: '',
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
                        id: false,
                        stroke: false,
                        'stroke-style': false,
                        'stroke-opacity': false,
                        'stroke-width': false,
                        links: false,
                        remarks: false,
                        callsign: false
                    },
                    properties: {
                        id: '',
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
                        id: false,
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
                        id: '',
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
        enabled: {
            deep: true,
            handler: function() {
                this.format();
            }
        },
        filters: {
            deep: true,
            handler: function() {
                this.format();
            }
        }
    },
    mounted: function() {
        for (const prop of ['id', 'remarks', 'callsign', 'links']) {
            if (!this.modelValue[prop] || (Array.isArray(this.modelValue[prop]) && this.modelValue[prop].length === 0)) {
                continue;
            }

            this.filters[prop] = this.modelValue[prop];
            this.enabled[prop] = true;
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

            for (const prop of ['id', 'remarks', 'callsign', 'links']) {
                if (!this.enabled[prop]) continue;
                res[prop] = styles[prop];
            }

            for (const geom of ['point', 'line', 'polygon']) {
                res[geom] = {};
                for (const key in styles[geom].enabled) {
                    if (!styles[geom].enabled[key]) continue;

                    if (['fill-opacity', 'stroke-width', 'stroke-opacity'].includes(key)) {
                        if (styles[geom].properties[key] !== undefined) res[geom][key] = Number(styles[geom].properties[key])
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

<template>
    <div class='row g-2'>
        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label class='user-select-none subheader'><IconLicense
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
                :schema='props.schema'
            />
        </div>

        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'> 
                <label class='user-select-none subheader'><IconBlockquote
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
                :schema='props.schema'
            />
        </div>

        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label class='user-select-none subheader'><IconBlockquote
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
                :schema='props.schema'
            />
        </div>

        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label class='user-select-none subheader'><IconLink
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
                :schema='props.schema'
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

        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label class='user-select-none subheader'><IconLicense
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
                :schema='props.schema'
            />
        </div>

        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label class='user-select-none subheader'><IconBlockquote
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
                :schema='props.schema'
            />
        </div>

        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label class='user-select-none subheader'><IconBlockquote
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
                :schema='props.schema'
            />
        </div>

        <div class='col-md-12 hover rounded px-2 py-2'>
            <div class='col-12 d-flex align-items-center'>
                <label class='user-select-none subheader'><IconLink
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
                :schema='props.schema'
            />
        </div>

        <template v-if='mode === "point"'>
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'><IconCategory
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
                    :schema='props.schema'
                />
            </div>
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'><IconPhoto
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
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'><IconPaint
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
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'>
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
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'><IconPaint
                        :size='20'
                        stroke='1'
                    /> Line Color
                    </label>
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

            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'><IconBorderStyle2
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
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'><IconRuler2
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
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'>
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
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'><IconPaint
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
            <div class='col-md-12 hover rounded px-2 py-2'>
                <div class='col-12 d-flex align-items-center'>
                    <label class='user-select-none subheader'>
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

<script setup>
import { ref, watch, onMounted } from 'vue';
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
import IconSelect from '../../../util/IconSelect.vue';
import StyleLinks from './StyleLinks.vue';
import {
    TablerRange,
    TablerInput,
    TablerToggle,
    TablerEnum
} from '@tak-ps/vue-tabler';

const props = defineProps({
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
});

const emit = defineEmits([ 'update:modelValue' ]);

const mode = ref('point');

const enabled = ref({
    id: false,
    remarks: false,
    callsign: false,
    links: false,
});

const filters = ref({
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
});

watch(enabled.value, format);
watch(filters.value, format);

onMounted(() => {
    for (const prop of ['id', 'remarks', 'callsign', 'links']) {
        if (!props.modelValue[prop] || (Array.isArray(props.modelValue[prop]) && props.modelValue[prop].length === 0)) {
            continue;
        }

        filters.value[prop] = props.modelValue[prop];
        enabled.value[prop] = true;
    }

    for (const key of ['point', 'line', 'polygon']) {
        if (!props.modelValue[key]) continue;
        for (const prop in props.modelValue[key]) {
            if (props.modelValue[key][prop] !== undefined) {
                filters.value[key].enabled[prop] = true;
            }
        }

        const style = JSON.parse(JSON.stringify(props.modelValue[key]));
        Object.assign(filters.value[key].properties, style);
    }

    format();
});

function format() {
    const styles = JSON.parse(JSON.stringify(filters.value));

    const res = {};

    for (const prop of ['id', 'remarks', 'callsign', 'links']) {
        if (!enabled.value[prop]) continue;
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

    emit('update:modelValue', res);
}
</script>

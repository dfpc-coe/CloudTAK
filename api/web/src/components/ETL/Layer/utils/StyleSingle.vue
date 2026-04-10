<template>
    <div class='row g-2'>
        <!-- Global Defaults -->
        <div class='col-12'>
            <span class='text-muted subheader'>Global Defaults</span>
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconLicense
                        :size='20'
                        stroke='1'
                    /> Global ID
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.id'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='enabled.id'
                v-model='filters.id'
                placeholder='Global ID Field'
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconBlockquote
                        :size='20'
                        stroke='1'
                    /> Global Callsign
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.callsign'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='enabled.callsign'
                v-model='filters.callsign'
                placeholder='Global Callsign Field'
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconClock
                        :size='20'
                        stroke='1'
                    /> Global Stale
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.stale'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='enabled.stale'
                v-model='filters.stale'
                placeholder='Stale Value (Seconds or ISO Date)'
                :disabled='disabled'
                :schema='props.schema'
            />
            <label
                v-if='enabled.stale && typeof filters.stale === "number"'
                class='text-muted small'
                v-text='humanSeconds(filters.stale)'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconEye
                        :size='20'
                        stroke='1'
                    /> Global Min Zoom
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.minzoom'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='enabled.minzoom'
                v-model='filters.minzoom'
                placeholder='Min Zoom (0-24)'
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconEye
                        :size='20'
                        stroke='1'
                    /> Global Max Zoom
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.maxzoom'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='enabled.maxzoom'
                v-model='filters.maxzoom'
                placeholder='Max Zoom (0-24)'
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconBlockquote
                        :size='20'
                        stroke='1'
                    /> Global Remarks
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.remarks'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='enabled.remarks'
                v-model='filters.remarks'
                rows=''
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconBlockquote
                        :size='20'
                        stroke='1'
                    /> Global Phone
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.phone'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='enabled.phone'
                v-model='filters.phone'
                placeholder='Global Phone Field'
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconLink
                        :size='20'
                        stroke='1'
                    /> Global Links
                </label>
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

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconServer
                        :size='20'
                        stroke='1'
                    /> Global Marti
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled.marti'
                        :disabled='disabled || props.disableMarti'
                        label='Enabled'
                    />
                </div>
            </div>
            <TablerInlineAlert
                v-if='props.disableMarti'
                type='info'
                class='mt-2'
                description='Marti routing is unavailable when a Data Sync destination is configured. Use Groups routing via Styles to set routing destinations.'
            />
            <StyleMarti
                v-else-if='enabled.marti'
                v-model='filters.marti'
                :disabled='disabled'
                :connection='props.connection'
            />
        </div>

        <!-- Geometry Overrides -->
        <div class='col-12 mt-2'>
            <span class='text-muted subheader'>Geometry Overrides</span>
        </div>

        <div class='col-12 d-flex justify-content-center'>
            <TablerPillGroup
                v-model='mode'
                :options='[
                    { value: "point", label: "Points" },
                    { value: "line", label: "Lines" },
                    { value: "polygon", label: "Polygons" }
                ]'
                :rounded='false'
                :full-width='false'
                size='default'
                padding=''
                name='geom-toolbar'
            >
                <template #option='{ option }'>
                    <IconPoint
                        v-if='option.value === "point"'
                        :size='32'
                        stroke='1'
                    />
                    <IconLine
                        v-if='option.value === "line"'
                        :size='32'
                        stroke='1'
                    />
                    <IconPolygon
                        v-if='option.value === "polygon"'
                        :size='32'
                        stroke='1'
                    />
                    {{ option.label }}
                </template>
            </TablerPillGroup>
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconLicense
                        :size='20'
                        stroke='1'
                    /> ID Override
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.id'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='filters[mode].enabled.id'
                v-model='filters[mode].properties.id'
                placeholder='ID Override'
                rows=''
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconBlockquote
                        :size='20'
                        stroke='1'
                    /> Callsign Override
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.callsign'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='filters[mode].enabled.callsign'
                v-model='filters[mode].properties.callsign'
                placeholder='Callsign Override'
                rows=''
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconClock
                        :size='20'
                        stroke='1'
                    /> Stale Override
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.stale'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='filters[mode].enabled.stale'
                v-model='filters[mode].properties.stale'
                placeholder='Stale Value (Seconds or ISO Date)'
                :disabled='disabled'
                :schema='props.schema'
            />
            <label
                v-if='filters[mode].enabled.stale && typeof filters[mode].properties.stale === "number"'
                class='text-muted small'
                v-text='humanSeconds(Number(filters[mode].properties.stale))'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconEye
                        :size='20'
                        stroke='1'
                    /> Min Zoom Override
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.minzoom'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='filters[mode].enabled.minzoom'
                v-model='filters[mode].properties.minzoom'
                placeholder='Min Zoom (0-24)'
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconEye
                        :size='20'
                        stroke='1'
                    /> Max Zoom Override
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.maxzoom'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='filters[mode].enabled.maxzoom'
                v-model='filters[mode].properties.maxzoom'
                placeholder='Max Zoom (0-24)'
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconBlockquote
                        :size='20'
                        stroke='1'
                    /> Remarks Override
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.remarks'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='filters[mode].enabled.remarks'
                v-model='filters[mode].properties.remarks'
                placeholder='Remarks Override'
                rows=''
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconBlockquote
                        :size='20'
                        stroke='1'
                    /> Phone Override
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='filters[mode].enabled.phone'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <HandleForm
                v-if='filters[mode].enabled.phone'
                v-model='filters[mode].properties.phone'
                placeholder='Phone Override'
                rows=''
                :disabled='disabled'
                :schema='props.schema'
            />
        </div>

        <div class='col-12 style-item px-2 py-2'>
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <IconLink
                        :size='20'
                        stroke='1'
                    /> Links Override
                </label>
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
            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconCategory
                            :size='20'
                            stroke='1'
                        /> Point Type
                    </label>
                    <div class='ms-auto'>
                        <TablerToggle
                            v-model='filters[mode].enabled.type'
                            :disabled='disabled'
                            label='Enabled'
                        />
                    </div>
                </div>
                <HandleForm
                    v-if='filters[mode].enabled.type'
                    v-model='filters[mode].properties.type'
                    placeholder='Type Override (a-f-G)'
                    :disabled='disabled'
                    :schema='props.schema'
                />
            </div>

            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconPhoto
                            :size='20'
                            stroke='1'
                        /> Point Icon
                    </label>
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
                    v-model='filters[mode].properties.icon!'
                    label=''
                    :disabled='disabled || !filters[mode].enabled.icon'
                />
            </div>

            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconPaint
                            :size='20'
                            stroke='1'
                        /> Point Color
                    </label>
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

            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconGhost
                            :size='20'
                            stroke='1'
                        /> Point Opacity
                    </label>
                    <span
                        v-if='filters[mode].enabled["marker-opacity"]'
                        class='mx-2 text-muted small'
                        v-text='`(${Math.round((filters[mode].properties["marker-opacity"] ?? 0) * 100)}%)`'
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

        <template v-else>
            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconPaint
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

            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconBorderStyle2
                            :size='20'
                            stroke='1'
                        /> Line Style
                    </label>
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

            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconRuler2
                            :size='20'
                            stroke='1'
                        /> Line Width
                    </label>
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

            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconGhost
                            :size='20'
                            stroke='1'
                        /> Line Opacity
                    </label>
                    <span
                        v-if='filters[mode].enabled["stroke-opacity"]'
                        class='mx-2 text-muted small'
                        v-text='`(${Math.round((filters[mode].properties["stroke-opacity"] ?? 0) * 100)}%)`'
                    />
                    <div class='ms-auto'>
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
            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconPaint
                            :size='20'
                            stroke='1'
                        /> Fill Color
                    </label>
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

            <div class='col-12 style-item px-2 py-2'>
                <div class='d-flex align-items-center'>
                    <label class='user-select-none subheader'>
                        <IconGhost
                            :size='20'
                            stroke='1'
                        /> Fill Opacity
                    </label>
                    <span
                        v-if='filters[mode].enabled["fill-opacity"]'
                        class='mx-2 text-muted small'
                        v-text='`(${Math.round((filters[mode].properties["fill-opacity"] ?? 0) * 100)}%)`'
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

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { humanSeconds } from '../../../../std.js';
import HandleForm from '../../../util/HandleForm.vue';
import StyleMarti from './StyleMarti.vue';
import {
    IconLink,
    IconServer,
    IconPaint,
    IconGhost,
    IconPoint,
    IconPhoto,
    IconLine,
    IconClock,
    IconEye,
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
    TablerEnum,
    TablerInlineAlert,
    TablerPillGroup
} from '@tak-ps/vue-tabler';

interface StyleLink {
    remarks: string;
    url: string;
    [key: string]: unknown;
}

interface GeometryProperties {
    id: string;
    stale: string;
    minzoom: number;
    maxzoom: number;
    remarks: string;
    phone: string;
    callsign: string;
    type?: string;
    links: StyleLink[];
    icon?: string;
    'marker-color'?: string;
    'marker-opacity'?: number;
    stroke?: string;
    'stroke-style'?: string;
    'stroke-opacity'?: number;
    'stroke-width'?: number;
    fill?: string;
    'fill-opacity'?: number;
    [key: string]: unknown;
}

interface GeometryOverride {
    enabled: Record<string, boolean>;
    properties: GeometryProperties;
    [key: string]: unknown;
}

interface StyleFilters {
    id: string;
    callsign: string;
    remarks: string;
    phone: string;
    stale: string;
    minzoom: number;
    maxzoom: number;
    links: StyleLink[];
    marti: Record<string, unknown>;
    point: GeometryOverride;
    line: GeometryOverride;
    polygon: GeometryOverride;
    [key: string]: unknown;
}

interface EnabledFlags {
    [key: string]: boolean;
}

const props = withDefaults(defineProps<{
    modelValue?: Record<string, unknown>;
    schema: Record<string, unknown>;
    disabled?: boolean;
    disableMarti?: boolean;
    connection?: number;
}>(), {
    modelValue: () => ({}),
    disabled: false,
    disableMarti: false,
    connection: undefined
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

const mode = ref<'point' | 'line' | 'polygon'>('point');

const enabled = ref<EnabledFlags>({
    id: false,
    stale: false,
    minzoom: false,
    maxzoom: false,
    remarks: false,
    phone: false,
    callsign: false,
    links: false,
    marti: false,
});

const filters = ref<StyleFilters>({
    id: '',
    callsign: '',
    remarks: '',
    phone: '',
    stale: '20',
    minzoom: 0,
    maxzoom: 24,
    links: [],
    marti: {},
    point: {
        enabled: {
            id: false,
            icon: false,
            links: false,
            stale: false,
            minzoom: false,
            maxzoom: false,
            'marker-color': false,
            'marker-opacity': false,
            remarks: false,
            phone: false,
            callsign: false
        },
        properties: {
            id: '',
            icon: '',
            stale: '20',
            minzoom: 0,
            maxzoom: 24,
            'marker-color': '#d63939',
            'marker-opacity': 1,
            remarks: '',
            phone: '',
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
            stale: false,
            minzoom: false,
            maxzoom: false,
            links: false,
            remarks: false,
            phone: false,
            callsign: false
        },
        properties: {
            id: '',
            stroke: '#d63939',
            'stroke-style': 'solid',
            'stroke-opacity': 1,
            'stroke-width': 3,
            stale: '20',
            minzoom: 0,
            maxzoom: 24,
            remarks: '',
            phone: '',
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
            stale: false,
            minzoom: false,
            maxzoom: false,
            fill: false,
            links: false,
            'fill-opacity': false,
            remarks: false,
            phone: false,
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
            stale: '20',
            minzoom: 0,
            maxzoom: 24,
            remarks: '',
            phone: '',
            callsign: '',
            links: []
        }
    }
});

watch(enabled, format, { deep: true });
watch(filters, format, { deep: true });

onMounted(() => {
    for (const prop of ['id', 'remarks', 'phone', 'callsign', 'links', 'minzoom', 'maxzoom', 'stale']) {
        if (props.modelValue[prop] === undefined || (Array.isArray(props.modelValue[prop]) && (props.modelValue[prop] as unknown[]).length === 0)) {
            continue;
        }

        filters.value[prop] = props.modelValue[prop];
        enabled.value[prop] = true;
    }

    if (props.modelValue.marti && Object.keys(props.modelValue.marti as Record<string, unknown>).length > 0) {
        filters.value.marti = JSON.parse(JSON.stringify(props.modelValue.marti));
        enabled.value.marti = true;
    }

    for (const key of ['point', 'line', 'polygon'] as const) {
        if (!props.modelValue[key]) continue;
        const geomInput = props.modelValue[key] as Record<string, unknown>;
        for (const prop in geomInput) {
            if (geomInput[prop] !== undefined) {
                filters.value[key].enabled[prop] = true;
            }
        }

        const style = JSON.parse(JSON.stringify(geomInput)) as Record<string, unknown>;
        Object.assign(filters.value[key].properties, style);
    }

    format();
});

function format() {
    const styles = JSON.parse(JSON.stringify(filters.value)) as StyleFilters;

    const res: Record<string, unknown> = {};

    for (const prop of ['id', 'remarks', 'phone', 'callsign', 'links', 'minzoom', 'maxzoom', 'stale']) {
        if (!enabled.value[prop]) continue;

        if (['minzoom', 'maxzoom', 'stale'].includes(prop) && !isNaN(Number(styles[prop]))) {
            res[prop] = Number(styles[prop]);
        } else {
            res[prop] = styles[prop];
        }
    }

    if (enabled.value.marti && styles.marti && Object.keys(styles.marti).length > 0) {
        res.marti = styles.marti;
    }

    for (const geom of ['point', 'line', 'polygon'] as const) {
        const geomRes: Record<string, unknown> = {};
        res[geom] = geomRes;
        for (const key in styles[geom].enabled) {
            if (!styles[geom].enabled[key]) continue;

            if (['minzoom', 'maxzoom', 'stale'].includes(key) && !isNaN(Number(styles[geom][key]))) {
                styles[geom][key] = Number(styles[geom][key]);
            } else if (['fill-opacity', 'stroke-width', 'stroke-opacity'].includes(key)) {
                if (styles[geom].properties[key] !== undefined) geomRes[key] = Number(styles[geom].properties[key]);
            } else if (['remarks', 'callsign', 'phone'].includes(key)) {
                if (styles[geom].properties[key]) geomRes[key] = styles[geom].properties[key];
            } else {
                geomRes[key] = styles[geom].properties[key];
            }
        }
    }

    emit('update:modelValue', res);
}
</script>

<style scoped>
.style-item {
    border: 1px solid transparent;
    border-radius: 4px;
    transition: border-color 0.15s ease;
}

.style-item:hover {
    border-color: var(--tblr-border-color, #e6e7e9);
}
</style>

<template>
    <div class='row g-2 mx-2 my-2'>
        <div class='col-12 mb-3'>
            <TablerPillGroup
                v-model='type'
                :options='[
                    { value: "agol", label: "ArcGIS Online" },
                    { value: "portal", label: "ArcGIS Enterprise Portal" }
                ]'
                :disabled='disabled'
                :rounded='false'
                size='default'
                padding=''
                name='esri-type'
            />
        </div>
        <template v-if='type === "agol"'>
            <div class='col-12'>
                <TablerInput
                    v-model='environment.ARCGIS_PORTAL'
                    label='ArcGIS Portal URL (Example: https://example.com/portal/sharing/rest)'
                    :disabled='disabled'
                />
            </div>
            <div
                v-if='environment.ARCGIS_URL'
                class='col-12'
            >
                <TablerInput
                    v-model='environment.ARCGIS_URL'
                    label='ArcGIS Layer URL'
                    :disabled='disabled'
                />
            </div>
            <div class='col-12 col-md-6 mt-3'>
                <TablerInput
                    v-model='environment.ARCGIS_USERNAME'
                    label='ArcGIS Username'
                    :disabled='disabled'
                />
            </div>
            <div class='col-12 col-md-6 mt-3'>
                <TablerInput
                    v-model='environment.ARCGIS_PASSWORD'
                    type='password'
                    autocomplete='new-password'
                    label='ArcGIS Password'
                    :disabled='disabled'
                />
            </div>
        </template>
        <template v-else-if='type === "portal"'>
            <div class='col-12'>
                <TablerInput
                    v-model='environment.ARCGIS_PORTAL'
                    label='ArcGIS Portal URL (Example: https://example.com/portal/sharing/rest)'
                    :disabled='disabled'
                />
            </div>

            <div
                v-if='environment.ARCGIS_URL'
                class='col-12'
            >
                <TablerInput
                    v-model='environment.ARCGIS_URL'
                    label='ArcGIS Layer URL'
                    :disabled='disabled'
                />
            </div>
            <div class='col-12 col-md-6 mt-3'>
                <TablerInput
                    v-model='environment.ARCGIS_USERNAME'
                    label='ArcGIS Username'
                    :disabled='disabled'
                />
            </div>
            <div class='col-12 col-md-6 mt-3'>
                <TablerInput
                    v-model='environment.ARCGIS_PASSWORD'
                    type='password'
                    autocomplete='new-password'
                    label='ArcGIS Password'
                    :disabled='disabled'
                />
            </div>
        </template>

        <div class='col-12 pb-4'>
            <TablerToggle
                v-model='environment.PRESERVE_HISTORY'
                label='Preserve History'
                description='If enabled, new features will be appended to existing features (Insert) in the layer instead of replacing them (Upsert)'
                :disabled='disabled'
            />
        </div>

        <div class='col-12 pb-4'>
            <div class='d-flex justify-content-center'>
                <div class='btn-list'>
                    <TablerPillGroup
                        v-model='mode'
                        :options='[
                            { value: "points", label: "Points" },
                            { value: "lines", label: "Lines" },
                            { value: "polys", label: "Polygons" }
                        ]'
                        :rounded='false'
                        :full-width='false'
                        size='default'
                        padding=''
                        name='geom-toolbar'
                    >
                        <template #option='{ option }'>
                            <IconPoint
                                v-if='option.value === "points"'
                                :size='32'
                                stroke='1'
                            />
                            <IconLine
                                v-if='option.value === "lines"'
                                :size='32'
                                stroke='1'
                            />
                            <IconPolygon
                                v-if='option.value === "polys"'
                                :size='32'
                                stroke='1'
                            />
                            {{ option.label }}
                        </template>
                    </TablerPillGroup>
                </div>
            </div>

            <TablerInput
                v-model='environment[`ARCGIS_${mode.toUpperCase()}_URL`]'
                :label='`ArcGIS ${modeLabel} Layer URL`'
                :disabled='disabled'
            />

            <Fields
                v-model='fieldMappings'
                :label='`ArcGIS ${modeLabel} Fields`'
                :disabled='disabled'
            />
        </div>

        <div class='col-md-12 mt-3'>
            <template v-if='!esriView'>
                <div class='d-flex'>
                    <div class='ms-auto'>
                        <button
                            class='cursor-pointer btn btn-secondary'
                            :disabled='!environment.ARCGIS_PORTAL || !environment.ARCGIS_USERNAME || !environment.ARCGIS_PASSWORD'
                            @click='esriView = true'
                        >
                            Connect
                        </button>
                    </div>
                </div>
            </template>
            <template v-else>
                <EsriPortal
                    :key='mode'
                    :disabled='disabled'
                    :url='environment.ARCGIS_PORTAL'
                    :readonly='disabled'
                    :pane='false'
                    :username='environment.ARCGIS_USERNAME'
                    :password='environment.ARCGIS_PASSWORD'
                    :layer='String(environment[`ARCGIS_${mode.toUpperCase()}_URL`] ?? "")'
                    @layer='environment[`ARCGIS_${mode.toUpperCase()}_URL`] = $event'
                    @close='esriView = false'
                />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import {
    TablerInput,
    TablerToggle,
    TablerPillGroup,
} from '@tak-ps/vue-tabler';
import EsriPortal from '../../util/EsriPortal.vue';
import Fields from './utils/Fields.vue';
import {
    IconPoint,
    IconLine,
    IconPolygon,
} from '@tabler/icons-vue'

type GeometryMode = 'points' | 'lines' | 'polys';
type FieldKey = 'ARCGIS_POINTS_FIELDS' | 'ARCGIS_LINES_FIELDS' | 'ARCGIS_POLYS_FIELDS';

interface ArcGISFieldMapping {
    name: string;
    type: string;
    field: string;
}

interface ArcGISOutgoingEnvironment {
    ARCGIS_URL?: string;
    ARCGIS_PORTAL?: string;
    ARCGIS_USERNAME?: string;
    ARCGIS_PASSWORD?: string;
    ARCGIS_QUERY?: string;
    ARCGIS_PARAMS?: Record<string, string>[];
    ARCGIS_TOKEN?: string;
    ARCGIS_EXPIRES?: string;
    ARCGIS_POINTS_URL?: string;
    ARCGIS_LINES_URL?: string;
    ARCGIS_POLYS_URL?: string;
    ARCGIS_POINTS_FIELDS?: ArcGISFieldMapping[];
    ARCGIS_LINES_FIELDS?: ArcGISFieldMapping[];
    ARCGIS_POLYS_FIELDS?: ArcGISFieldMapping[];
    PRESERVE_HISTORY?: boolean;
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    modelValue: ArcGISOutgoingEnvironment;
    disabled?: boolean;
}>(), {
    disabled: true,
})

const emit = defineEmits<{
    (e: 'update:modelValue', value: ArcGISOutgoingEnvironment): void;
}>();

const mode = ref<GeometryMode>('points');

const fieldMappings = computed<ArcGISFieldMapping[]>({
    get() {
        const value = environment.value[fieldKey(mode.value)];
        return Array.isArray(value) ? value as ArcGISFieldMapping[] : [];
    },
    set(value) {
        environment.value[fieldKey(mode.value)] = value;
    }
});

const modeLabel = computed(() => {
    if (mode.value === 'lines') return 'Line';
    if (mode.value === 'polys') return 'Polygon';

    return 'Point';
});

const type = ref('agol');
if (props.modelValue.ARCGIS_PORTAL && props.modelValue.ARCGIS_PORTAL.includes('arcgis.com') && props.modelValue.ARCGIS_USERNAME) {
    type.value = 'agol';
} else if (props.modelValue.ARCGIS_PORTAL && props.modelValue.ARCGIS_USERNAME) {
    type.value = 'portal';
}

const esriView = ref(false);
const environment = ref<ArcGISOutgoingEnvironment>(props.modelValue);

if (!environment.value.ARCGIS_URL) environment.value.ARCGIS_URL = '';
if (!environment.value.PRESERVE_HISTORY) environment.value.PRESERVE_HISTORY = false;
if (!environment.value.ARCGIS_POINTS_URL) environment.value.ARCGIS_POINTS_URL = '';
if (!environment.value.ARCGIS_LINES_URL) environment.value.ARCGIS_LINES_URL = '';
if (!environment.value.ARCGIS_POLYS_URL) environment.value.ARCGIS_POLYS_URL = '';
if (!Array.isArray(environment.value.ARCGIS_POINTS_FIELDS)) environment.value.ARCGIS_POINTS_FIELDS = [];
if (!Array.isArray(environment.value.ARCGIS_LINES_FIELDS)) environment.value.ARCGIS_LINES_FIELDS = [];
if (!Array.isArray(environment.value.ARCGIS_POLYS_FIELDS)) environment.value.ARCGIS_POLYS_FIELDS = [];

watch(type, () => {
    delete environment.value.ARCGIS_PORTAL;
    delete environment.value.ARCGIS_USERNAME;
    delete environment.value.ARCGIS_PASSWORD;
    environment.value.ARCGIS_QUERY = '';
    environment.value.ARCGIS_PARAMS = [];
    delete environment.value.ARCGIS_TOKEN;
    delete environment.value.ARCGIS_EXPIRES;
});

watch(() => props.modelValue, () => {
    environment.value = props.modelValue;
}, { deep: true });

watch(environment, () => {
    emit('update:modelValue', environment.value);
}, { deep: true });

function fieldKey(activeMode: GeometryMode): FieldKey {
    if (activeMode === 'lines') return 'ARCGIS_LINES_FIELDS';
    if (activeMode === 'polys') return 'ARCGIS_POLYS_FIELDS';

    return 'ARCGIS_POINTS_FIELDS';
}
</script>

<template>
    <div class='row g-2 mx-2 my-2'>
        <div class='col-12 mb-3'>
            <div
                class='btn-group w-100'
                role='group'
            >
                <input
                    id='agol'
                    type='radio'
                    class='btn-check'
                    name='esri-type'
                    autocomplete='off'
                    :disabled='disabled'
                    :checked='type === "agol"'
                    @click='type = "agol"'
                >
                <label
                    for='agol'
                    type='button'
                    class='btn'
                >ArcGIS Online</label>

                <input
                    id='portal'
                    type='radio'
                    class='btn-check'
                    name='esri-type'
                    autocomplete='off'
                    :disabled='disabled'
                    :checked='type === "portal"'
                    @click='type = "portal"'
                >
                <label
                    for='portal'
                    type='button'
                    class='btn'
                >ArcGIS Enterprise Portal</label>
            </div>
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
                    label='ArcGIS Password'
                    :disabled='disabled'
                />
            </div>
        </template>

        <div class='col-12 pb-4'>
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
                            value='points'
                        >
                        <label
                            class='btn btn-icon px-3'
                            @click='mode="points"'
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
                            value='lines'
                        >
                        <label
                            class='btn btn-icon px-3'
                            @click='mode="lines"'
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
                            value='polys'
                        >
                        <label
                            class='btn btn-icon px-3'
                            @click='mode="polys"'
                        >
                            <IconPolygon
                                :size='32'
                                stroke='1'
                            /> Polygons
                        </label>
                    </div>
                </div>
            </div>

            <TablerInput
                v-model='environment[`ARCGIS_${mode.toUpperCase()}_URL`]'
                :label='`ArcGIS ${mode} Layer URL`'
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
                    :layer='environment[`ARCGIS_${mode.toUpperCase()}_URL`]'
                    @layer='environment[`ARCGIS_${mode.toUpperCase()}_URL`] = $event'
                    @close='esriView = false'
                />
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import EsriPortal from '../../util/EsriPortal.vue';
import {
    IconPoint,
    IconLine,
    IconPolygon,
} from '@tabler/icons-vue'

const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    },
    disabled: {
        type: Boolean,
        default: true
    }
})

const emit = defineEmits([ 'update:modelValue' ]);

const mode = ref('points');

const type = ref('agol');
if (props.modelValue.ARCGIS_PORTAL && props.modelValue.ARCGIS_PORTAL.includes('arcgis.com') && props.modelValue.ARCGIS_USERNAME) {
    type.value = 'agol';
} else if (props.modelValue.ARCGIS_PORTAL && props.modelValue.ARCGIS_USERNAME) {
    type.value = 'portal';
}

const esriView = ref(false);
const environment = ref(props.modelValue);

if (!environment.value.ARCGIS_URL) environment.value.ARCGIS_URL = '';
if (!environment.value.ARCGIS_POINTS_URL) environment.value.ARCGIS_POINTS_URL = '';
if (!environment.value.ARCGIS_LINES_URL) environment.value.ARCGIS_LINES_URL = '';
if (!environment.value.ARCGIS_POLYS_URL) environment.value.ARCGIS_POLYS_URL = '';

watch(type, () => {
    delete environment.value.ARCGIS_PORTAL;
    delete environment.value.ARCGIS_USERNAME;
    delete environment.value.ARCGIS_PASSWORD;
    environment.value.ARCGIS_QUERY = '';
    environment.value.ARCGIS_PARAMS = [];
    delete environment.value.ARCGIS_TOKEN;
    delete environment.value.ARCGIS_EXPIRES;
});

watch(props.modelValue, () => {
    environment.value = props.modelValue;
});

watch(environment, () => {
    emit('update:modelValue', environment.value);
});
</script>

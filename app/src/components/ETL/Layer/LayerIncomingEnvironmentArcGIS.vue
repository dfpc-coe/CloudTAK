<template>
    <div class='row g-2 mx-2 my-2'>
        <div class='col-12 mb-3'>
            <TablerPillGroup
                v-model='type'
                :options='[
                    { value: "agol", label: "ArcGIS Online" },
                    { value: "portal", label: "ArcGIS Enterprise Portal" },
                    { value: "server", label: "ArcGIS Server" }
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
        <template v-else-if='type === "server"'>
            <div class='col-12'>
                <TablerInput
                    v-model='environment.ARCGIS_URL'
                    label='ArcGIS Layer URL'
                    :disabled='disabled'
                />
            </div>
        </template>

        <label
            class='subheader mt-3 cursor-pointer'
            @click='advanced = !advanced'
        >
            <IconSquareChevronRight
                v-if='!advanced'
                :size='32'
                stroke='1'
            />
            <IconChevronDown
                v-else
                :size='32'
                stroke='1'
            />
            Advanced Options
        </label>

        <div
            v-if='advanced'
            class='col-12'
        >
            <div class='row g-2'>
                <div class='col-2'>
                    <TablerEnum
                        v-model='environment.ARCGIS_QUERY_STRATEGY'
                        default='Query'
                        :options='["Query", "QueryTopFeatures"]'
                        label='Strategy'
                        :disabled='disabled || !environment.ARCGIS_URL'
                    />
                </div>
                <div class='col-10 d-flex'>
                    <div class='w-100'>
                        <TablerInput
                            v-model='environment.ARCGIS_QUERY'
                            label='ArcGIS SQL Query'
                            :disabled='disabled || !environment.ARCGIS_URL'
                        />
                    </div>
                    <button
                        v-if='!disabled && environment.ARCGIS_URL'
                        class='btn'
                        style='height: 40px; margin-left: 8px; margin-top: 28px;'
                        @click='filterModal = true'
                    >
                        <IconFilter
                            :size='32'
                            stroke='1'
                        /> Query Editor
                    </button>
                </div>
                <div class='col-12'>
                    <div class='col-12 d-flex align-items-center'>
                        <label class='mx-2'>Custom URL Parameters</label>
                        <div class='ms-auto'>
                            <TablerIconButton
                                v-if='!disabled'
                                title='Add Parameter'
                                @click='Array.isArray(environment.ARCGIS_PARAMS) ? environment.ARCGIS_PARAMS.push({ Key: "", Value: "" }) : environment.ARCGIS_PARAMS = [{ Key: "", Value: "" }]'
                            >
                                <IconPlus stroke='1' />
                            </TablerIconButton>
                        </div>
                    </div>

                    <TablerNone
                        v-if='!environment.ARCGIS_PARAMS || environment.ARCGIS_PARAMS.length === 0'
                        label='No Custom Params'
                        :compact='true'
                        :create='false'
                    />
                    <template v-else>
                        <div
                            v-for='(param, pit) of environment.ARCGIS_PARAMS'
                            :key='pit'
                            class='row mt-2'
                        >
                            <div class='col-md-6'>
                                <TablerInput
                                    v-model='param.Key'
                                    :disabled='disabled'
                                    placeholder='Param Key'
                                />
                            </div>
                            <div class='col-md-6 d-flex align-items-center'>
                                <TablerInput
                                    v-model='param.Value'
                                    :style='disabled ? "width: 100%" : "width: calc(100% - 32px)"'
                                    :disabled='disabled'
                                    placeholder='Param Value'
                                />
                                <TablerDelete
                                    v-if='!disabled'
                                    class='mx-2'
                                    displaytype='icon'
                                    @delete='environment.ARCGIS_PARAMS.splice(pit, 1)'
                                />
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
        <div
            v-if='type !== "server"'
            class='col-md-12 mt-3'
        >
            <template v-if='!esriView'>
                <div class='d-flex'>
                    <div class='ms-auto'>
                        <a
                            class='cursor-pointer btn btn-secondary'
                            @click='esriView = true;'
                        >Connect</a>
                    </div>
                </div>
            </template>
            <template v-else>
                <EsriPortal
                    :disabled='disabled'
                    :url='environment.ARCGIS_PORTAL'
                    :readonly='true'
                    :username='environment.ARCGIS_USERNAME'
                    :password='environment.ARCGIS_PASSWORD'
                    :layer='environment.ARCGIS_URL'
                    @layer='environment.ARCGIS_URL = $event'
                    @close='esriView = false'
                />
            </template>
        </div>

        <EsriFilter
            v-if='filterModal'
            v-model='environment.ARCGIS_QUERY'
            :token='environment.ARCGIS_TOKEN'
            :layer='environment.ARCGIS_URL'
            @close='filterModal = false'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    TablerIconButton,
    TablerEnum,
    TablerDelete,
    TablerInput,
    TablerNone,
    TablerPillGroup,
} from '@tak-ps/vue-tabler';
import EsriPortal from '../../util/EsriPortal.vue';
import EsriFilter from '../../util/EsriFilter.vue';
import {
    IconPlus,
    IconSquareChevronRight,
    IconChevronDown,
    IconFilter,
} from '@tabler/icons-vue'

interface ArcGISEnvironment {
    ARCGIS_URL?: string;
    ARCGIS_PORTAL?: string;
    ARCGIS_USERNAME?: string;
    ARCGIS_PASSWORD?: string;
    ARCGIS_QUERY?: string;
    ARCGIS_QUERY_STRATEGY?: string;
    ARCGIS_PARAMS?: Record<string, string>[];
    ARCGIS_TOKEN?: string;
    ARCGIS_EXPIRES?: string;
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    modelValue: ArcGISEnvironment;
    disabled?: boolean;
}>(), {
    disabled: true,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: ArcGISEnvironment): void;
}>();

let initialType = 'agol';
if (!props.modelValue.ARCGIS_PORTAL && !props.modelValue.ARCGIS_USERNAME) {
    initialType = 'server';
} else if (props.modelValue.ARCGIS_PORTAL && props.modelValue.ARCGIS_PORTAL.includes('arcgis.com') && props.modelValue.ARCGIS_USERNAME) {
    initialType = 'agol';
} else if (props.modelValue.ARCGIS_PORTAL && props.modelValue.ARCGIS_USERNAME) {
    initialType = 'portal';
}

const type = ref(initialType);
const advanced = ref(false);
const esriView = ref(false);
const environment = ref<ArcGISEnvironment>(JSON.parse(JSON.stringify(props.modelValue)));
const filterModal = ref(false);

if (!Array.isArray(environment.value.ARCGIS_PARAMS)) {
    environment.value.ARCGIS_PARAMS = [];
}

if (!environment.value.ARCGIS_QUERY_STRATEGY) {
    environment.value.ARCGIS_QUERY_STRATEGY = 'Query';
}

watch(type, () => {
    delete environment.value.ARCGIS_URL;
    delete environment.value.ARCGIS_PORTAL;
    delete environment.value.ARCGIS_USERNAME;
    delete environment.value.ARCGIS_PASSWORD;
    environment.value.ARCGIS_QUERY = '';
    environment.value.ARCGIS_QUERY_STRATEGY = 'Query';
    environment.value.ARCGIS_PARAMS = [];
    delete environment.value.ARCGIS_TOKEN;
    delete environment.value.ARCGIS_EXPIRES;
});

watch(() => props.modelValue, (newValue) => {
    if (JSON.stringify(newValue) === JSON.stringify(environment.value)) return;
    environment.value = JSON.parse(JSON.stringify(newValue));
}, { deep: true });

watch(environment, (newValue) => {
    emit('update:modelValue', newValue);
}, { deep: true });
</script>


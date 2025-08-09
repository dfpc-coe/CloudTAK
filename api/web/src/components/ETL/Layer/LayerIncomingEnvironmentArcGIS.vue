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

                <input
                    id='server'
                    type='radio'
                    class='btn-check'
                    name='esri-type'
                    autocomplete='off'
                    :disabled='disabled'
                    :checked='type === "server"'
                    @click='type = "server"'
                >
                <label
                    for='server'
                    type='button'
                    class='btn'
                >ArcGIS Server</label>
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
                <div class='col-12 d-flex'>
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
                        label='Custom Params'
                        :compact='true'
                        :create='false'
                    />
                    <template v-else>
                        <div
                            v-for='(param, pit) of environment.ARCGIS_PARAMS'
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
                            @click='connect'
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

<script>
import {
    TablerIconButton,
    TablerDelete,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import EsriPortal from '../../util/EsriPortal.vue';
import EsriFilter from '../../util/EsriFilter.vue';
import {
    IconPlus,
    IconSquareChevronRight,
    IconChevronDown,
    IconFilter,
} from '@tabler/icons-vue'

export default {
    name: 'LayerEnvironmentArcGIS',
    components: {
        EsriPortal,
        IconPlus,
        IconSquareChevronRight,
        IconChevronDown,
        IconFilter,
        TablerIconButton,
        TablerInput,
        TablerNone,
        TablerDelete,
        EsriFilter
    },
    props: {
        modelValue: {
            type: Object,
            required: true
        },
        disabled: {
            type: Boolean,
            default: true
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        let type = 'agol';
        if (!this.modelValue.ARCGIS_PORTAL && !this.modelValue.ARCGIS_USERNAME) {
            type = 'server';
        } else if (this.modelValue.ARCGIS_PORTAL && this.modelValue.ARCGIS_PORTAL.includes('arcgis.com') && this.modelValue.ARCGIS_USERNAME) {
            type = 'agol';
        } else if (this.modelValue.ARCGIS_PORTAL && this.modelValue.ARCGIS_USERNAME) {
            type = 'portal';
        }

        return {
            type,
            advanced: false,
            esriView: false,
            environment: this.modelValue,
            filterModal: false,
        };
    },
    watch: {
        type: function() {
            delete this.environment.ARCGIS_URL;
            delete this.environment.ARCGIS_PORTAL;
            delete this.environment.ARCGIS_USERNAME;
            delete this.environment.ARCGIS_PASSWORD;
            this.environment.ARCGIS_QUERY = '';
            this.environment.ARCGIS_PARAMS = [];
            delete this.environment.ARCGIS_TOKEN;
            delete this.environment.ARCGIS_EXPIRES;
        },
        modelValue: function() {
            this.environment = this.modelValue;
        },
        environment: function() {
            this.$emit('update:modelValue', this.environment);
        }
    },
    methods: {
        connect: function() {
            this.esriView = true;
        }
    }
}
</script>

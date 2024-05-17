<template>
<div class='row g-2 mx-2 my-2'>
    <div v-if='!disabled' class='col-12 mb-3'>
        <div class="btn-group w-100" role="group">
            <input type="radio" class="btn-check" name="esri-type" id="agol" autocomplete="off" @click='type = "agol"' :checked='type === "agol"'>
            <label for="agol" type="button" class="btn">ArcGIS Online</label>

            <input type="radio" class="btn-check" name="esri-type" id="portal" autocomplete="off" @click='type = "portal"' :checked='type === "portal"'>
            <label for="portal" type="button" class="btn">ArcGIS Enterprise Portal</label>

            <input type="radio" class="btn-check" name="esri-type" id="server" autocomplete="off" @click='type = "server"' :checked='type === "server"'>
            <label for="server" type="button" class="btn">ArcGIS Server</label>
        </div>
    </div>

    <template v-if='type === "agol"'>
        <div class="col-12">
            <TablerInput
                label='ArcGIS Portal URL (Example: https://example.com/portal/sharing/rest)'
                :disabled='disabled'
                v-model='environment.ARCGIS_PORTAL'
            />
        </div>

        <div v-if='environment.ARCGIS_URL' class="col-12">
            <TablerInput
                label='ArcGIS Layer URL'
                :disabled='disabled'
                v-model='environment.ARCGIS_URL'
            />
        </div>
        <div class="col-12 col-md-6 mt-3">
            <TablerInput
                label='ArcGIS Username'
                :disabled='disabled'
                v-model='environment.ARCGIS_USERNAME'
            />
        </div>
        <div class="col-12 col-md-6 mt-3">
            <TablerInput
                type='password'
                label='ArcGIS Password'
                :disabled='disabled'
                v-model='environment.ARCGIS_PASSWORD'
            />
        </div>
    </template>
    <template v-else-if='type === "portal"'>
        <div class="col-12">
            <TablerInput
                label='ArcGIS Portal URL (Example: https://example.com/portal/sharing/rest)'
                :disabled='disabled'
                v-model='environment.ARCGIS_PORTAL'
            />
        </div>

        <div v-if='environment.ARCGIS_URL' class="col-12">
            <TablerInput
                label='ArcGIS Layer URL'
                :disabled='disabled'
                v-model='environment.ARCGIS_URL'
            />
        </div>
        <div class="col-12 col-md-6 mt-3">
            <TablerInput
                label='ArcGIS Username'
                :disabled='disabled'
                v-model='environment.ARCGIS_USERNAME'
            />
        </div>
        <div class="col-12 col-md-6 mt-3">
            <TablerInput
                type='password'
                label='ArcGIS Password'
                :disabled='disabled'
                v-model='environment.ARCGIS_PASSWORD'
            />
        </div>
    </template>
    <template v-else-if='type === "server"'>
        <div class="col-12">
            <TablerInput
                label='ArcGIS Layer URL'
                :disabled='disabled'
                v-model='environment.ARCGIS_URL'
            />
        </div>
    </template>

    <label @click='advanced = !advanced' class='subheader mt-3 cursor-pointer'>
        <IconSquareChevronRight v-if='!advanced' size='32'/>
        <IconChevronDown size='32' v-else/>
        Advanced Options
    </label>

    <div v-if='advanced' class='col-12'>
        <div class='row'>
            <div class="col-12">
                <div class='d-flex'>
                    <div class='w-100'>
                        <TablerInput
                            label='ArcGIS SQL Query'
                            :disabled='disabled || !environment.ARCGIS_URL'
                            v-model='environment.ARCGIS_QUERY'
                        />
                    </div>
                    <button
                        v-if='!disabled && environment.ARCGIS_URL'
                        @click='filterModal = true'
                        class='btn'
                        style='height: 40px; margin-left: 8px; margin-top: 28px;'
                    ><IconFilter size='32'/> Query Editor</button>
                </div>
            </div>
        </div>
    </div>
    <div v-if='type !== "server"' class="col-md-12 mt-3">
        <template v-if='!esriView'>
            <div class='d-flex'>
                <div class='ms-auto'>
                    <a @click='connect' class="cursor-pointer btn btn-secondary">Connect</a>
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
                @token='processToken($event)'
                @close='esriView = false'
            />
        </template>
    </div>

    <EsriFilter
        v-if='filterModal'
        @close='filterModal = false'
        v-model='environment.ARCGIS_QUERY'
        :token='environment.ARCGIS_TOKEN'
        :layer='environment.ARCGIS_URL'
    />
</div>
</template>

<script>
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import EsriPortal from './../util/EsriPortal.vue';
import EsriFilter from './../util/EsriFilter.vue';
import {
    IconSquareChevronRight,
    IconChevronDown,
    IconFilter,
} from '@tabler/icons-vue'

export default {
    name: 'LayerEnvironmentArcGIS',
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
    watch: {
        type: function() {
            delete this.environment.ARCGIS_URL;
            delete this.environment.ARCGIS_PORTAL;
            delete this.environment.ARCGIS_USERNAME;
            delete this.environment.ARCGIS_PASSWORD;
            this.environment.ARCGIS_QUERY = '';
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
    data: function() {
        let type = 'agol';
        console.error(JSON.stringify(this.modelValue))
        if (!this.modelValue.ARCGIS_PORTAL && !this.modelValue.ARCGIS_USERNAME) {
            type = 'server';
        } else if (this.modelValue.ARCGIS_PORTAL.includes('arcgis.com') && this.modelValue.ARCGIS_USERNAME) {
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
    methods: {
        connect: function() {
            this.esriView = true;
        },
        processToken: function(token) {
            if (!token) return;

            this.environment.ARCGIS_TOKEN = token.token;
            this.environment.ARCGIS_EXPIRES = token.expires;
        }
    },
    components: {
        EsriPortal,
        IconSquareChevronRight,
        IconChevronDown,
        TablerInput,
        IconFilter,
        EsriFilter
    }
}
</script>

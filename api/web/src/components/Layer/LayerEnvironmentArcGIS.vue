<template>
<div class='row g-2 mx-2 my-2'>
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
    <div class="col-12 mt-3">
        <div class='d-flex'>
            <div class='w-100'>
                <TablerInput
                    label='ArcGIS SQL Query'
                    :disabled='disabled'
                    v-model='environment.ARCGIS_QUERY'
                />
            </div>
            <button v-if='!disabled' @click='filterModal = true' class='btn' style='margin-left: 8px; margin-top: 26px;'><FilterIcon/> Query Editor</button>
        </div>
    </div>
    <div class="col-md-12 mt-3">
        <template v-if='!esriView'>
            <div class='d-flex'>
                <div class='ms-auto'>
                    <a @click='esriView = true' class="cursor-pointer btn btn-secondary">Connect</a>
                </div>
            </div>
        </template>
        <template v-else>
            <EsriPortal
                :disabled='disabled'
                :url='environment.ARCGIS_PORTAL'
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
        :token='{
            token: environment.ARCGIS_TOKEN,
            expires: environment.ARCGIS_EXPIRES
        }'
        :layer='environment.ARCGIS_URL'
    />
</div>
</template>

<script>
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import Schema from './utils/Schema.vue';
import EsriPortal from './../util/EsriPortal.vue';
import EsriFilter from './../util/EsriFilter.vue';
import {
    PlusIcon,
    FilterIcon,
    SettingsIcon,
} from 'vue-tabler-icons'

export default {
    name: 'LayerEnvironment',
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
        modelValue: function() {
            this.environment = this.modelValue;
        },
        environment: function() {
            this.$emit('update:modelValue', this.environment);
        }
    },
    data: function() {
        return {
            esriView: false,
            environment: this.modelValue,
            filterModal: false,
        };
    },
    methods: {
        processToken(token) {
            if (!token) return;

            this.environment.ARCGIS_TOKEN = token.token;
            this.environment.ARCGIS_EXPIRES = token.expires;
        }
    },
    components: {
        PlusIcon,
        SettingsIcon,
        EsriPortal,
        TablerInput,
        FilterIcon,
        EsriFilter
    }
}
</script>

<template>
    <div>
        <TablerLoading v-if='loading' />
        <template v-else>
            <div class='card-header'>
                <h3 class='card-title'>
                    CloudTAK Settings
                </h3>
                <div class='ms-auto'>
                    <div class='btn-list'>
                        <TablerIconButton
                            v-if='!edit'
                            title='Edit'
                            @click='edit = true'
                        >
                            <IconPencil
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
            </div>
            <div class='card-body row'>
                <div
                    class='col-lg-12 hover py-2 cursor-pointer'
                    @click='opened.has("login") ? opened.delete("login") : opened.add("login")'
                >
                    <IconChevronDown v-if='opened.has("login")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>Login Page</span>
                </div>

                <div
                    v-if='opened.has("login")'
                    class='col-lg-12 py-2 border rounded'
                >
                    <div class='row'>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config["login::signup"]'
                                :disabled='!edit'
                                :error='validateURL(config["login::signup"])'
                                label='TAK Server Signup Link'
                            />
                            <TablerInput
                                v-model='config["login::forgot"]'
                                :disabled='!edit'
                                :error='validateURL(config["login::forgot"])'
                                label='TAK Server Password Reset Link'
                            />

                            <UploadLogo
                                v-model='config["login::logo"]'
                                label='Login Logo'
                                :disabled='!edit'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover py-2 cursor-pointer'
                    @click='opened.has("agol") ? opened.delete("agol") : opened.add("agol")'
                >
                    <IconChevronDown v-if='opened.has("agol")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>ArcGIS Online</span>
                </div>

                <div
                    v-if='opened.has("agol")'
                    class='col-lg-12 py-2 border rounded'
                >
                    <div class='row'>
                        <div class='col-lg-12'>
                            <TablerToggle
                                v-model='config["agol::enabled"]'
                                :disabled='!edit'
                                label='ArcGIS Online Enabled'
                            />
                            <TablerInput
                                v-model='config["agol::token"]'
                                type='password'
                                :disabled='!edit'
                                label='ArcGIS Online API Token'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover py-2 cursor-pointer'
                    @click='opened.has("media") ? opened.delete("media") : opened.add("media")'
                >
                    <IconChevronDown v-if='opened.has("media")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>Media Server</span>
                </div>

                <div
                    v-if='opened.has("media")'
                    class='col-lg-12 py-2 border rounded'
                >
                    <div class='row'>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config["media::url"]'
                                :disabled='!edit'
                                :error='validateURL(config["media::url"])'
                                label='CloudTAK Hosted MediaMTX Service URL'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover py-2 cursor-pointer'
                    @click='opened.has("display") ? opened.delete("display") : opened.add("display")'
                >
                    <IconChevronDown v-if='opened.has("display")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>Display Defaults</span>
                </div>

                <div
                    v-if='opened.has("display")'
                    class='col-lg-12 py-2 border rounded'
                >
                    <div class='row'>
                        <TablerInlineAlert
                            title='Application Behavior'
                            description='These are the default display settings for new users. Existing users will not be affected.'
                        />

                        <div
                            v-for='display in Object.keys(config).filter(key => key.startsWith("display::"))'
                            :key='display'
                            class='col-lg-12'
                        >
                            <TablerEnum
                                v-model='config[display]'
                                :label='display.replace("display::", "") === "icon_rotation" ? "Rotate Icons with Course" : display.replace("display::", "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())'
                                :options='displayUnits[display.replace("display::", "")] || []'
                                :disabled='!edit'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover py-2 cursor-pointer'
                    @click='opened.has("groups") ? opened.delete("groups") : opened.add("groups")'
                >
                    <IconChevronDown v-if='opened.has("groups")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>TAK User Groups</span>
                </div>

                <div
                    v-if='opened.has("groups")'
                    class='col-lg-12 py-2 border rounded'
                >
                    <div class='row'>
                        <div
                            v-for='group in groups'
                            :key='group'
                            class='col-lg-12'
                        >
                            <TablerInput
                                v-model='config[`group::${group}`]'
                                :label='group'
                                :disabled='!edit'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover py-2 cursor-pointer'
                    @click='opened.has("map") ? opened.delete("map") : opened.add("map")'
                >
                    <IconChevronDown v-if='opened.has("map")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>Map Settings</span>
                </div>

                <div
                    v-if='opened.has("map")'
                    class='col-lg-12 py-2 border rounded'
                >
                    <div class='row'>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config[`map::center`]'
                                label='Initial Map Center (<lat>,<lng>)'
                                placeholder='Latitude, Longitude'
                                :error='validateLatLng(config[`map::center`])'
                                :disabled='!edit'
                            />
                        </div>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config[`map::zoom`]'
                                label='Initial Map Zoom'
                                :disabled='!edit'
                            />
                        </div>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config[`map::pitch`]'
                                label='Initial Map Pitch'
                                :disabled='!edit'
                            />
                        </div>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config[`map::bearing`]'
                                label='Initial Map Bearing'
                                :disabled='!edit'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover py-2 cursor-pointer'
                    @click='opened.has("provider") ? opened.delete("provider") : opened.add("provider")'
                >
                    <IconChevronDown v-if='opened.has("provider")' />
                    <IconChevronRight v-else />

                    <span class='mx-2 user-select-none'>COTAK OAuth Provider</span>
                </div>

                <div
                    v-if='opened.has("provider")'
                    class='col-lg-12 py-2 border rounded'
                >
                    <div class='row'>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config[`provider::url`]'
                                label='Provider URL'
                                :disabled='!edit'
                            />
                        </div>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config[`provider::secret`]'
                                label='Provider Secret'
                                :disabled='!edit'
                            />
                        </div>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config[`provider::client`]'
                                label='Provider Client'
                                :disabled='!edit'
                            />
                        </div>
                    </div>
                </div>

                <div
                    v-if='edit'
                    class='col-lg-12 d-flex py-2'
                >
                    <div
                        class='btn'
                        @click='fetch'
                    >
                        Cancel
                    </div>
                    <div class='ms-auto'>
                        <div
                            class='btn btn-primary'
                            @click='postConfig'
                        >
                            Save Settings
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { std, stdurl } from '../../std.ts';
import { validateURL, validateLatLng } from '../../base/validators.ts';
import {
    TablerLoading,
    TablerInlineAlert,
    TablerIconButton,
    TablerEnum,
    TablerToggle,
    TablerInput
} from '@tak-ps/vue-tabler';
import UploadLogo from '../util/UploadLogo.vue';
import {
    IconPencil,
    IconChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';

const groups = ref([
    "Yellow",
    "Cyan",
    "Green",
    "Red",
    "Purple",
    "Orange",
    "Blue",
    "Magenta",
    "White",
    "Maroon",
    "Dark Blue",
    "Teal",
    "Dark Green",
    "Brown",
]);

const config = ref({
    'agol::enabled': false,
    'agol::token': '',

    'media::url': '',

    'map::center': '40,-100',
    'map::zoom': 4,
    'map::bearing': 0,
    'map::pitch': 0,

    'provider::url': '',
    'provider::secret': '',
    'provider::client': '',

    'login::logo': '',
    'login::forgot': '',
    'login::signup': '',

})

const displayUnits = ref({});

for (const group of groups.value) {
    config.value[`group::${group}`] = '';
}

const edit = ref(false);
const loading = ref(true);
const opened = ref(new Set());

onMounted(async () => {
    await fetch();
});

async function fetch() {
    edit.value = false;
    loading.value = true;

    try {
        const display = await std('/api/config/display')
        for (const [key, value] of Object.entries(display)) {
            displayUnits.value[key] = value.options;
        }

        const url = stdurl('/api/config')
        url.searchParams.append('keys', Object.keys(config.value).join(','));
        const configRes = await std(url);

        for (const key of Object.keys(configRes)) {
            if (configRes[key] === undefined) continue;

            // Keep coordinate format consistent for users
            if (key === 'map::center') {
                config.value[key] = configRes[key].split(',').reverse().join(',');
            } else {
                config.value[key] = configRes[key];
            }
        }

        for (const key of Object.keys(display)) {
            config.value[`display::${key}`] = display[key].value;
        }
    } catch (error) {
        console.error('Failed to load admin config:', error);
        // Page will load with default values from config.value initialization
    }

    loading.value = false;
}

async function postConfig() {
    loading.value = true;
    try {
        await std(`/api/config`, {
            method: 'PUT',
            body: {
                ...config.value,
                'map::center': config.value['map::center'].split(',').reverse().join(','),
            }
        });
        
        // Force reload display config to clear any caching
        const display = await std('/api/config/display');
        for (const [key, value] of Object.entries(display)) {
            displayUnits.value[key] = value.options;
            config.value[`display::${key}`] = value.value;
        }
        
        edit.value = false;
    } catch (error) {
        console.error('Failed to save admin config:', error);
        // Keep edit mode active so user can try again
    } finally {
        loading.value = false;
    }
}
</script>

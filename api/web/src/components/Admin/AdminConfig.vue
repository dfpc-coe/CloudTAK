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
                    class='col-lg-12 hover-light py-2 cursor-pointer'
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
                                :error='(config["login::signup"] && config["login::signup"].startsWith("http")) ? "" : "Invalid URL"'
                                label='TAK Server Signup Link'
                            />
                            <TablerInput
                                v-model='config["login::forgot"]'
                                :disabled='!edit'
                                :error='(config["login::forgot"] && config["login::forgot"].startsWith("http")) ? "" : "Invalid URL"'
                                label='TAK Server Password Reset Link'
                            />

                            <UploadLogo
                                label='Login Logo'
                                v-model='config["login::logo"]'
                                :disabled='!edit'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover-light py-2 cursor-pointer'
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
                    class='col-lg-12 hover-light py-2 cursor-pointer'
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
                                label='CloudTAK Hosted MediaMTX Service URL'
                            />
                        </div>
                    </div>
                </div>

                <div
                    class='col-lg-12 hover-light py-2 cursor-pointer'
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
                    class='col-lg-12 hover-light py-2 cursor-pointer'
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
                                label='Inital Map Center'
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
                    class='col-lg-12 hover-light py-2 cursor-pointer'
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

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerLoading,
    TablerIconButton,
    TablerToggle,
    TablerInput
} from '@tak-ps/vue-tabler';
import UploadLogo from '../util/UploadLogo.vue';
import {
    IconPencil,
    IconChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import timeDiff from '../../timediff.ts';

export default {
    name: 'AdminConfig',
    components: {
        IconPencil,
        IconChevronRight,
        IconChevronDown,
        TablerLoading,
        TablerIconButton,
        UploadLogo,
        TablerToggle,
        TablerInput,
    },
    data: function() {
        const groups = [
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
        ];

        const config = {
            'agol::enabled': false,
            'agol::token': '',

            'media::url': '',

            'map::center': '-100,40',
            'map::zoom': 4,
            'map::bearing': 0,
            'map::pitch': 0,

            'provider::url': '',
            'provider::secret': '',
            'provider::client': '',

            'login::logo': '',
            'login::forgot': '',
            'login::signup': '',
        }

        for (const group of groups) {
            config[`group::${group}`] = '';
        }

        return {
            edit: false,
            loading: true,
            opened: new Set(),
            groups,
            config
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        timeDiff: function(updated) {
            return timeDiff(updated);
        },
        fetch: async function() {
            this.edit = false;
            this.loading = true;
            const url = stdurl('/api/config')
            url.searchParams.append('keys', Object.keys(this.config).join(','));
            const config = await std(url);

            for (const key of Object.keys(config)) {
                if (config[key] === undefined) continue;
                this.config[key] = config[key];
            }

            this.loading = false;
        },
        postConfig: async function() {
            this.loading = true;
            await std(`/api/config`, {
                method: 'PUT',
                body: this.config
            });

            this.edit = false;
            this.loading = false;
        }
    }
}
</script>

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
                        <IconSettings
                            v-if='!edit'
                            v-tooltip='"Configure Server"'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='edit = true'
                        />
                    </div>
                </div>
            </div>
            <div class='card-body row'>
                <div
                    @click='opened.has("agol") ? opened.delete("agol") : opened.add("agol")'
                    class='col-lg-12 hover-light py-2 cursor-pointer'
                >
                    <IconChevronDown v-if='opened.has("agol")'/>
                    <IconChevronRight v-else/>

                    <span class='mx-2 user-select-none'>ArcGIS Online</span>
                </div>

                <div v-if='opened.has("agol")' class='col-lg-12 py-2 border rounded'>
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
                    @click='opened.has("media") ? opened.delete("media") : opened.add("media")'
                    class='col-lg-12 hover-light py-2 cursor-pointer'
                >
                    <IconChevronDown v-if='opened.has("media")'/>
                    <IconChevronRight v-else/>

                    <span class='mx-2 user-select-none'>Media Server</span>
                </div>

                <div v-if='opened.has("media")' class='col-lg-12 py-2 border rounded'>
                    <div class='row'>
                        <div class='col-lg-12'>
                            <TablerInput
                                v-model='config["media::url"]'
                                :disabled='!edit'
                                label='Hosted Media Service URL'
                            />
                        </div>

                        <div class='col-lg-6'>
                            <TablerInput
                                v-model='config["media::username"]'
                                :disabled='!edit'
                                label='Hosted Media Service Username'
                            />
                        </div>

                        <div class='col-lg-6'>
                            <TablerInput
                                v-model='config["media::password"]'
                                type='password'
                                :disabled='!edit'
                                label='Hosted Media Service Password'
                            />
                        </div>
                    </div>
                </div>

                <div
                    @click='opened.has("groups") ? opened.delete("groups") : opened.add("groups")'
                    class='col-lg-12 hover-light py-2 cursor-pointer'
                >
                    <IconChevronDown v-if='opened.has("groups")'/>
                    <IconChevronRight v-else/>

                    <span class='mx-2 user-select-none'>TAK User Groups</span>
                </div>

                <div v-if='opened.has("groups")' class='col-lg-12 py-2 border rounded'>
                    <div class='row'>
                        <div v-for='group in Object.keys(config["group::names"])' :key='group' class='col-lg-12'>
                            <TablerInput
                                :label='group'
                                v-model='config["group::names"][group]'
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
    TablerToggle,
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
    IconChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import timeDiff from '../../timediff.ts';

export default {
    name: 'AdminConfig',
    components: {
        IconSettings,
        IconChevronRight,
        IconChevronDown,
        TablerLoading,
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
            'media::username': '',
            'media::password': '',

            'group::names': {}
        }

        for (const group of groups) {
            config['group::names'][group] = '';
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

<template>
<div>
    <TablerLoading v-if='loading'/>
    <template v-else>
        <div class="card-header">
            <h3 class='card-title'>CloudTAK Settings</h3>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <IconSettings
                        v-if='false'
                        v-tooltip='"Configure Server"'
                        size='32'
                        class='cursor-pointer'
                        @click='edit = true'
                    />
                </div>
            </div>
        </div>
        <div class="card-body row">
            <div class='col-lg-12 py-2'>
                <TablerInput
                    v-model='config.esri_token'
                    :disabled='!edit'
                    label='ESRI AGOL Token'
                />
            </div>

            <div v-if='edit' class='col-lg-12 d-flex py-2'>
                <div class='ms-auto'>
                    <div @click='postConfig' class='btn btn-primary'>
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
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconLock,
    IconSettings
} from '@tabler/icons-vue';
import timeDiff from '../../timediff.js';

export default {
    name: 'AdminConfig',
    data: function() {
        return {
            edit: false,
            loading: true,
            config: {
                enabled_esri: false,
                esri_token: ''
            }
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
            this.loading = true;
            const url = stdurl('/api/config')
            url.searchParams.append('keys', Object.keys(this.config).join(','));
            const config = await std(url);
            for (const key of Object.keys(config)) {
                if (config[key] === undefined) continue;
                this.config = config[key];
            }
            this.loading = false;
        },
        postServer: async function() {
            this.loading = true;
            await std(`/api/config`, {
                method: 'PUT',
                body: this.config
            });

            this.edit = false;
            this.loading = false;
        }
    },
    components: {
        IconSettings,
        TablerLoading,
        TablerInput,
        IconLock,
        IconPlus,
    }
}
</script>

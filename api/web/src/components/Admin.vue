<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <TablerLoading v-if='loading'/>
                        <template v-else>
                            <div class="card-header">
                                <h3 class='card-title'>TAK Server Configuration</h3>
                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <SettingsIcon v-tooltip='"Configure Server"' class='cursor-pointer' @click='edit = true'/>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class='row'>
                                    <div class='col-lg-12 py-2'>
                                        <TablerInput
                                            v-model='server.name'
                                            :disabled='!edit'
                                            label='TAK Server Name'
                                            placeholder='ssl://'
                                            :error='errors.name'
                                        />
                                    </div>

                                    <div class='col-lg-12 py-2'>
                                        <TablerInput
                                            v-model='server.url'
                                            :disabled='!edit'
                                            label='TAK Server Streaming CoT'
                                            placeholder='ssl://'
                                            :error='errors.url'
                                        />
                                    </div>

                                    <div class='col-lg-12 py-2'>
                                        <TablerInput
                                            v-model='server.api'
                                            :disabled='!edit'
                                            label='TAK Server API'
                                            placeholder='https://'
                                            :error='errors.api'
                                        />
                                    </div>

                                    <div v-if='edit' class='col-lg-12 d-flex py-2'>
                                        <div class='ms-auto'>
                                            <div @click='postServer' class='btn btn-primary'>
                                                Save Server
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if='server.updated' class="card-footer">
                                <span v-text='`Last Updated: ${timeDiff(server.updated)}`'/>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import {
    TablerBreadCrumb,
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    SettingsIcon
} from 'vue-tabler-icons';
import timeDiff from '../timediff.js';

export default {
    name: 'Admin',
    data: function() {
        return {
            edit: false,
            loading: true,
            errors: {
                name: '',
                url: '',
                api: ''
            },
            server: {
                id: null,
                created: null,
                updated: null,
                name: '',
                url: '',
                api: '',
                auth: {}
            }
        }
    },
    mounted: async function() {
        await this.fetch();

        if (this.server.status === 'unconfigured') this.edit = true;
    },
    methods: {
        timeDiff: function(updated) {
            return timeDiff(updated);
        },
        fetch: async function() {
            this.loading = true;
            this.server = await window.std(`/api/server`);
            this.loading = false;
        },
        postServer: async function() {
            for (const field of ['api', 'url', 'name']) {
                this.errors[field] = !this.server[field] ? 'Cannot be empty' : '';
            }

            for (const field of ['api', 'url']) {
                if (!this.errors[field]) {
                    try {
                        new URL(this.server[field]);
                    } catch (err) {
                        this.errors[field] = err.message;
                    }
                }
            }

            for (const e in this.errors) if (this.errors[e]) return;

            this.loading = true;
            if (this.server.status === 'unconfigured') {
                this.server = await window.std(`/api/server`, {
                    method: 'POST',
                    body: {
                        name: this.server.name,
                        url: this.server.url
                    }
                });
            } else {
                this.server = await window.std(`/api/server`, {
                    method: 'PATCH',
                    body: {
                        name: this.server.name,
                        url: this.server.url,
                        api: this.server.api
                    }
                });
            }

            this.edit = false;
            this.loading = false;
        }
    },
    components: {
        PageFooter,
        SettingsIcon,
        TablerBreadCrumb,
        TablerLoading,
        TablerInput
    }
}
</script>

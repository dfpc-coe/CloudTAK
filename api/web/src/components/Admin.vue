<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/")' class='cursor-pointer'>Home</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#">Admin</a></li>
                        </ol>
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
                                        <SettingsIcon class='cursor-pointer' @click='edit = true'/>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <template v-if='server.status==="configured"'>
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
                                                label='TAK Server URL'
                                                placeholder='ssl://'
                                                :error='errors.url'
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
                                </template>
                                <template v-else-if='server.status === "unconfigured"'>
                                    <div class='d-flex justify-content-center'>
                                        <NoteIcon :height='48' :width='48'/>
                                    </div>
                                    <div class='d-flex justify-content-center'>
                                        <span>No Connection Found</span>
                                    </div>
                                </template>
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
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    NoteIcon,
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
                url: ''
            },
            server: {
                id: null,
                created: null,
                updated: null,
                url: '',
                auth: {}
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
            this.server = await window.std(`/api/server`);
            this.loading = false;
        },
        postServer: async function() {
            for (const field of ['url', 'name']) {
                this.errors[field] = !this.server[field] ? 'Cannot be empty' : '';
            }

            if (!this.errors.url) {
                try {
                    new URL(this.server.url);
                } catch (err) {
                    this.errors.url = err.message;
                }
            }

            for (const e in this.errors) if (this.errors[e]) return;

            this.loading = true;
            if (this.server.status === 'unconfigured') {
                this.server = await window.std(`/api/server`, {
                    method: 'POST',
                    body: {
                        url: this.server.url
                    }
                });
            } else {
                this.server = await window.std(`/api/server`, {
                    method: 'PATCH',
                    body: {
                        url: this.server.url
                    }
                });
            }

            this.edit = false;
            this.loading = false;
        }
    },
    components: {
        NoteIcon,
        PageFooter,
        SettingsIcon,
        TablerLoading,
        TablerInput
    }
}
</script>

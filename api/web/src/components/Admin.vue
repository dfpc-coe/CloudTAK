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
                        <template v-else-if='!edit'>
                            <div class="card-header">
                                <h3 class='card-title'>TAK Server Configuration</h3>
                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <SettingsIcon class='cursor-pointer' @click='edit = true'/>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <template v-if='edit'>
                                    <TablerInput v-model='server.url' placeholder='ssl://'/>

                                    <div class='btn'>
                                        Save Server
                                    </div>
                                </template>
                                <template v-else>

                                </template>
                            </div>
                            <div v-if='server.updated' class="card-footer">
                                <span v-text='`Last Updated: ${server.updated}`'/>
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
    SettingsIcon
} from 'vue-tabler-icons';
import timeDiff from '../timediff.js';

export default {
    name: 'Admin',
    data: function() {
        return {
            edit: false,
            loading: true,
            server: {
                id: null,
                created: null,
                updated: null,
                url: ''
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
        }
    },
    components: {
        PageFooter,
        SettingsIcon,
        TablerLoading,
        TablerInput
    }
}
</script>

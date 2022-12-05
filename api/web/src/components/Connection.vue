<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/")' class='cursor-pointer'>Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/connection")' class='cursor-pointer'>Connections</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#" v-text='connection.id'></a></li>
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
                        <div class="card-header">
                            <ConnectionStatus :connection='connection'/>

                            <a @click='$router.push(`/connetion/${connection.id}`)' class="card-title cursor-pointer" v-text='connection.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <SettingsIcon class='cursor-pointer' @click='$router.push(`/connection/${connection.id}/edit`)'/>
                                </div>
                            </div>
                        </div>
                        <div class="card-body" v-text='connection.description'>
                        </div>
                        <div class="card-footer">
                            Last updated 3 mins ago
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <Err v-if='err' :err='err' @close='err = null'/>
    <PageFooter/>
</div>
</template>

<script>
import { Err } from '@tak-ps/vue-tabler';
import PageFooter from './PageFooter.vue';
import ConnectionStatus from './Connection/Status.vue';
import {
    SettingsIcon
} from 'vue-tabler-icons'

export default {
    name: 'Connections',
    data: function() {
        return {
            err: false,
            connection: {

            }
        }
    },
    mounted: function() {
        this.fetch();
    },
    methods: {
        fetch: async function() {
            try {
                this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}`);
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        Err,
        SettingsIcon,
        PageFooter,
        ConnectionStatus
    }
}
</script>

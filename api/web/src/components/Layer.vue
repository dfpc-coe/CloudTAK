<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/")' class='cursor-pointer'>Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/layers")' class='cursor-pointer'>Layers</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#" v-text='layer.id'></a></li>
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
                            <span class="status-indicator status-green status-indicator-animated">
                                  <span class="status-indicator-circle"></span>
                                  <span class="status-indicator-circle"></span>
                                  <span class="status-indicator-circle"></span>
                            </span>

                            <a @click='$router.push(`/layer/${layer.id}`)' class="card-title cursor-pointer" v-text='layer.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <span v-text='cronstr(layer.cron)'/>

                                    <SettingsIcon class='cursor-pointer' @click='$router.push(`/layer/${layer.id}/edit`)'/>
                                </div>
                            </div>
                        </div>
                        <div class="card-body" v-text='layer.description'>
                        </div>
                        <div class="card-footer">
                            Last updated 3 mins ago
                        </div>
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
import cronstrue from 'cronstrue';
import {
    SettingsIcon,
} from 'vue-tabler-icons'

export default {
    name: 'Layer',
    data: function() {
        return {
            err: false,
            layer: {
            }
        }
    },
    mounted: function() {
        this.fetch();
    },
    methods: {
        cronstr: function(cron) {
            if (!cron) return;
            return cronstrue.toString(cron);
        },
        fetch: async function() {
            try {
                this.layer = await window.std(`/api/layer/${this.$route.params.layerid}`);
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        SettingsIcon,
        PageFooter,
    }
}
</script>

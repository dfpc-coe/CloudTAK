<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/")' class='cursor-pointer'>Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/layer")' class='cursor-pointer'>Layers</a></li>
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
                            Last updated <span v-text='timeDiff(layer.updated)'/>
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
        timeDiff: function(updated) {
            const msPerMinute = 60 * 1000;
            const msPerHour = msPerMinute * 60;
            const msPerDay = msPerHour * 24;
            const msPerMonth = msPerDay * 30;
            const msPerYear = msPerDay * 365;
            const elapsed = +(new Date()) - updated;

            if (elapsed < msPerMinute) return Math.round(elapsed/1000) + ' seconds ago';
            if (elapsed < msPerHour) return Math.round(elapsed/msPerMinute) + ' minutes ago';
            if (elapsed < msPerDay ) return Math.round(elapsed/msPerHour ) + ' hours ago';
            if (elapsed < msPerMonth) return '~' + Math.round(elapsed/msPerDay) + ' days ago';
            if (elapsed < msPerYear) return '~' + Math.round(elapsed/msPerMonth) + ' months ago';
            return '~' + Math.round(elapsed/msPerYear ) + ' years ago';
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

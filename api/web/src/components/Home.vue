<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item active" aria-current="page"><a href="#">Layers</a></li>
                        </ol>

                        <div class='ms-auto'>
                            <a @click='$router.push("/layer/new")' class="cursor-pointer btn btn-primary">
                                New Layer
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div :key='layer.id' v-for='layer in list.layers' class="col-lg-12">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title" v-text='layer.name'></h3>
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

export default {
    name: 'Home',
    data: function() {
        return {
            err: false,
            list: {
                layers: []
            }
        }
    },
    mounted: function() {
        this.fetchList();
    },
    methods: {
        fetchList: async function() {
            try {
                this.list = await window.std('/api/layer');
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        PageFooter,
    }
}
</script>

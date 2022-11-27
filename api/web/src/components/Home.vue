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
                        <div class="card-body">
                            This is a wider card with supporting text below as a natural lead-in to additional content. This card has even longer content than the first to show that equal height action.
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
    components: {
        PageFooter,
    }
}
</script>

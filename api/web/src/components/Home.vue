<template>
<div>
    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class='col-sm-6 col-lg-3'>
                    <CardConnections @err='err = $event'/>
                </div>
                <div class='col-sm-6 col-lg-3'>
                    <CardLayers @err='err = $event'/>
                </div>
                <div class='col-12'>
                    <CardTopStats/>
                </div>
                <div class='col-lg-6'>
                    <CardLocation/>
                </div>
                <div class='col-lg-6'>
                    <CardRegistered/>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import CardConnections from './cards/Connections.vue';
import CardLayers from './cards/Layers.vue';
import CardLocation from './cards/Location.vue';
import CardTopStats from './cards/TopStats.vue';
import CardRegistered from './cards/Registered.vue';

export default {
    name: 'Home',
    components: {
        PageFooter,
        CardConnections,
        CardLayers,
        CardLocation,
        CardTopStats,
        CardRegistered
    }
}
</script>

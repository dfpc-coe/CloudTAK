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
import CardConnections from './cards/Connections.vue';
import CardLayers from './cards/Layers.vue';

export default {
    name: 'Home',
    data: function() {
        return {
            err: false,
        }
    },
    components: {
        Err,
        PageFooter,
        CardConnections,
        CardLayers
    }
}
</script>

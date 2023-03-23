<template>
<div class='card'>
    <div class='card-header'>
        <div class='row row-cards'>
            <div class='col-md-4'>
                <h3 class='card-title'>Data Assets</h3>
            </div>
        </div>
    </div>

    <div class='card-body'>
        <None v-if='!assets.length' :create='false'/>
    </div>
</div>
</template>

<script>
import {
} from 'vue-tabler-icons'
import None from '../cards/None.vue';

export default {
    name: 'DataAssets',
    props: {
    },
    data: function() {
        return {
            assets: []
        };
    },
    mounted: function() {
    },
    methods: {
    },
    components: {
        None
    }
}
</script>

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
        <TablerLoading v-if='loading.list'/>
        <None v-else-if='!assets.length' :create='false'/>
    </div>
</div>
</template>

<script>
import {
} from 'vue-tabler-icons'
import None from '../cards/None.vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataAssets',
    props: {
    },
    data: function() {
        return {
            assets: []
        };
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            this.loading.list = true;
            this.assets = await window.std(`/api/data/${this.$route.params.dataid}/asset`);
            this.loading.list = false;
        }
    },
    components: {
        None,
        TablerLoading
    }
}
</script>

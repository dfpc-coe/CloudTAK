<template>
<div class="card">
    <div class="card-header">
        <h3 class="card-title">User Groups</h3>
    </div>
    <div class="card-body">
        <div :key='data.name' v-for='data in list.data'>
            <span v-text='data.name'/>
            <span v-text='data.description'/>
        </div>
    </div>

</div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import None from '../cards/None.vue';

export default {
    name: 'ProfileGroups',
    data: function() {
        return {
            loading: true,
            list: {}
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.list = await window.std('/api/marti/group');
            this.loading = false;
        },
    },
    components: {
        TablerLoading
    }
}
</script>

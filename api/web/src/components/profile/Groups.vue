<template>
<div class="card">
    <div class="card-body">
        <div class="d-flex">
            <h3 class="card-title">User Groups</h3>
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
            groups: []
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.list = await window.std('/api/token');
            this.loading = false;
        },
    },
    components: {
        TablerLoading
    }
}
</script>

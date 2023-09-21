<template>
<div class="card">
    <div class="card-header">
        <h3 class="card-title">User Groups</h3>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!list.data.length' :create='false'/>
    <table v-else class="table card-table table-hover table-vcenter">
        <thead>
            <tr>
                <th>Group Name</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr :key='group.name' v-for='group in list.data'>
                <td v-text='group.name'></td>
                <td v-text='group.description'></td>
            </tr>
        </tbody>
    </table>
</div>
</template>

<script>
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'ProfileGroups',
    data: function() {
        return {
            loading: true,
            list: {
                data: []
            }
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
        TablerNone,
        TablerLoading
    }
}
</script>

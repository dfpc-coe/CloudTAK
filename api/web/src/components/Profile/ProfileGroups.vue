<template>
<div>
    <div class="card-header">
        <h3 class="card-title">User Groups</h3>

        <div class='ms-auto btn-list'>
            <IconRefresh @click='fetch' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!list.data.length' :create='false'/>
    <div v-else class='table-responsive'>
        <table class="table card-table table-hover table-vcenter">
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
</div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    IconRefresh
} from '@tabler/icons-vue';
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
            this.list = await std('/api/marti/group');
            this.loading = false;
        },
    },
    components: {
        IconRefresh,
        TablerNone,
        TablerLoading
    }
}
</script>

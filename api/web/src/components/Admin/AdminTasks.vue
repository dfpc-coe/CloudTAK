<template>
<div>
    <div class="card-header">
        <h3 class='card-title'>ETL Tasks</h3>
        <div class='ms-auto'>
            <div class='btn-list'>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <div v-else class="card-body">
        <div :key='task' v-for='task in Object.keys(tasks.items)' class='hover-light px-2 py-2 d-flex'>
            <div v-text='task'/>
            <div class='ms-auto'>
                <span v-text='tasks.items[task].length'/> Versions
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
} from '@tabler/icons-vue';

export default {
    name: 'AdminTask',
    data: function() {
        return {
            loading: true,
            tasks: {
                total: 0,
                items: []
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.tasks = await window.std(`/api/task`);
            this.loading = false;
        }
    },
    components: {
        TablerLoading,
    }
}
</script>

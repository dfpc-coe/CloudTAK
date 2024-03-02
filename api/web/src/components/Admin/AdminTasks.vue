<template>
<div>
    <div class="card-header">
        <template v-if='task'>
            <IconCircleArrowLeft @click='task = null' class='cursor-pointer'/>
            <h3 class='mx-2 card-title' v-text='task'></h3>
        </template>
        <template v-else>
            <h3 class='card-title'>ETL Tasks</h3>
        </template>
        <div class='ms-auto'>
            <div class='btn-list'>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone
        v-else-if='!Object.keys(tasks.items)'
        label='Tasks'
        :create='false'
    />
    <template v-else-if='task'>
        <div class="table-responsive">
            <table class="table card-table table-hover table-vcenter datatable cursor-pointer">
                <tbody>
                    <tr :key='version' v-for='version in tasks.items[task]'>
                        <td v-text='version'/>
                    </tr>
                </tbody>
            </table>
        </div>
    </template>
    <template v-else>
        <div class="table-responsive">
            <table class="table card-table table-hover table-vcenter datatable cursor-pointer">
                <tbody>
                    <tr @click='task = t' :key='t' v-for='t in Object.keys(tasks.items)'>
                        <td v-text='t'/>
                        <td v-text='`${tasks.items[t].length} Versions`'/>
                    </tr>
                </tbody>
            </table>
        </div>
    </template>
</div>
</template>

<script>
import {
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'AdminTask',
    data: function() {
        return {
            loading: true,
            task: null,
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
        IconCircleArrowLeft,
    }
}
</script>

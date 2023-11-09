<template>
<div class='col-12'>
    <TablerLoading v-if='loading' desc='Loading Missions'/>
    <template v-else>
        <div class='table-responsive'>
            <table class="table card-table table-hover table-vcenter datatable">
                <thead>
                    <tr>
                        <th>Mission Name</th>
                    </tr>
                </thead>
                <tbody>
                    <tr :key='mission_it' v-for='(mission, mission_it) in list.data' class='cursor-pointer'>
                        <td v-text='mission.name'></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </template>
</div>
</template>

<script>
export default {
    name: 'ListMissions',
    data: function() {
        return {
            loading: true,
            list: {
                data: {}
            }
        }
    },
    mounted: async function() {
        await this.fetchMissions();
    },
    methods: {
        fetchMissions: async function() {
            this.loading = true;
            this.list = await window.std('/api/marti/mission');
            this.loading = false;
        }
    },
}
</script>

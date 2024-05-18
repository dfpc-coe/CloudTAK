<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Data Groups
            </h3>
        </div>
        <TablerNone
            v-if='!data.mission_groups.length'
            :create='false'
        />
        <div
            v-else
            class='table-responsive'
        >
            <table class='table card-table table-hover table-vcenter'>
                <thead>
                    <tr><th>Group Name</th></tr>
                </thead>
                <tbody>
                    <tr
                        v-for='group in data.mission_groups'
                        :key='group'
                    >
                        <td v-text='group' />
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
import {
    TablerNone,
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionGroups',
    components: {
        TablerNone,
    },
    props: {
        data: {
            type: Object,
            required: true
        }
    }
}
</script>

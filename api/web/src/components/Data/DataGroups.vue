<template>
    <div>
        <div class='card-header'>
            <h2 class='card-title'>
                Data Groups
            </h2>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Refresh'
                    @click='listLayers'
                > <IconRefresh :size='32' stroke='1' /></TablerIconButton>
            </div>
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
    TablerIconButton
} from '@tak-ps/vue-tabler';

import {
    IconRefresh
} from '@tabler/icons-vue'

export default {
    name: 'ConnectionGroups',
    components: {
        IconRefresh,
        TablerNone,
        TablerIconButton
    },
    props: {
        data: {
            type: Object,
            required: true
        }
    }
}
</script>

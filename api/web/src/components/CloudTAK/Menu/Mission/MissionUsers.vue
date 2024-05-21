<template>
    <div v-for='sub of subscriptions'>
        <div class='col-12 py-2 px-2 d-flex hover-dark'>
            <div class='row col-12 align-items-center'>
                <div class='col-auto mx-2'>
                    <div v-text='sub.username' />
                    <div
                        class='subheader'
                        v-text='sub.username'
                    />
                </div>
                <div class='col-auto ms-auto btn-list'>
                    <IconUserBolt v-if='sub.role.type === "MISSION_OWNER"' size='32' v-tooltip='sub.role.type'/>
                    <IconUserEdit v-else-if='sub.role.type === "MISSION_SUBSCRIBER"' size='32' v-tooltip='sub.role.type'/>
                    <IconUser size='32' v-else-if='sub.role.type === "MISSION_READONLY_SUBSCRIBER"' v-tooltip='sub.role.type'/>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {
    IconUserBolt,
    IconUserEdit,
    IconUser
} from '@tabler/icons-vue';

export default {
    name: 'MissionUsers',
    props: {
        subscriptions: Array
    },
    components: {
        IconUserBolt,
        IconUserEdit,
        IconUser
    }
}
</script>

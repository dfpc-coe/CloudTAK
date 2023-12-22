<template>
<div class='row' :class='{
    "bg-dark text-white": !modal
}'>
    <div class='col-12' :class='{
        "border-bottom border-light": !modal
    }'>
        <div class='modal-header' :class='{
            "px-0 mx-2": !modal
        }'>
            <IconCircleArrowLeft v-if='!modal' @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Missions</div>
            <div class='btn-list'>
                <template v-if='!loading'>
                    <IconPlus @click='$emit("create")' class='cursor-pointer' v-tooltip='"Create Mission"'/>
                    <IconRefresh @click='fetchMissions' class='cursor-pointer' v-tooltip='"Refresh"'/>
                </template>
            </div>
        </div>
    </div>
    <div class='modal-body mx-3 my-2'>
        <TablerLoading v-if='loading' desc='Loading Missions'/>
        <TablerNone v-else-if='!list.data.length' label='Missions' :create='false'/>
        <Alert v-else-if='err' :err='err'/>
        <template v-else>
            <div
                @click='$emit("mission", mission)'
                :key='mission_it'
                v-for='(mission, mission_it) in list.data'
                class='cursor-pointer col-12 row py-2 rounded'
                :class='{ "hover-dark": !modal, "hover-light": modal }'
            >
                <div class='col-auto d-flex justify-content-center align-items-center'>
                    <IconLock v-if='mission.passwordProtected'/>
                    <IconLockOpen v-else/>
                </div>
                <div class='col-auto row'>
                    <div class='col-12'>
                        <span v-text='mission.name'/>
                    </div>
                    <div class='col-12'>
                        <span v-text='mission.createTime.replace(/T.*/, "")' class='text-secondary'/>
                        &nbsp;-&nbsp;
                        <span v-text='mission.contents.length + " Items"' class='text-secondary'/>
                    </div>
                </div>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue';
import Alert from '../util/Alert.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionList',
    props: {
        connection: {
            type: Number
        },
        modal: {
            type: Boolean,
            default: true
        }
    },
    data: function() {
        return {
            err: false,
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
            try {
                this.loading = true;
                const url = window.stdurl('/api/marti/mission');
                url.searchParams.append('passwordProtected', 'true');
                if (this.connection) url.searchParams.append('connection', this.connection);
                this.list = await window.std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        }
    },
    components: {
        Alert,
        TablerNone,
        TablerLoading,
        IconCircleArrowLeft,
        IconRefresh,
        IconPlus,
        IconLock,
        IconLockOpen
    }
}
</script>

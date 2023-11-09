<template>
<div class='col-12'>
    <div class='modal-header'>
        <div class='modal-title'>Missions</div>
        <PlusIcon @click='$emit("create")' class='cursor-pointer'/>
        <RefreshIcon v-if='!loading' @click='fetchMissions' class='cursor-pointer'/>
    </div>
    <div class='modal-body'>
        <TablerLoading v-if='loading' desc='Loading Missions'/>
        <template v-else>
            <div
                @click='$emit("mission", mission)'
                :key='mission_it'
                v-for='(mission, mission_it) in list.data'
                class='cursor-pointer col-12 row my-2'
            >
                <div class='col-auto'>
                    <LockIcon v-if='mission.passwordProtected'/>
                    <LockOpenIcon v-else/>
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
    LockIcon,
    LockOpenIcon,
    RefreshIcon,
} from 'vue-tabler-icons';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

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
            const url = window.stdurl('/api/marti/mission');
            url.searchParams.append('passwordProtected', 'true');
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        TablerLoading,
        RefreshIcon,
        LockIcon,
        LockOpenIcon
    }
}
</script>

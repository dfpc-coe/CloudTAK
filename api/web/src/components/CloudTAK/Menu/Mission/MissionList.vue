<template>
    <div>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft
                    size='32'
                    class='cursor-pointer'
                    @click='$emit("close")'
                />
                <div class='modal-title'>
                    Missions
                </div>
                <div class='btn-list'>
                    <IconPlus
                        v-tooltip='"Create Mission"'
                        size='32'
                        class='cursor-pointer'
                        @click='$emit("create")'
                    />
                    <IconRefresh
                        v-tooltip='"Refresh"'
                        size='32'
                        class='cursor-pointer'
                        @click='fetchMissions'
                    />
                </div>
            </div>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Loading Missions'
        />
        <TablerNone
            v-else-if='!list.data.length'
            label='Missions'
            :create='false'
        />
        <TablerAlert
            v-else-if='err'
            :err='err'
        />
        <template v-else>
            <div
                v-for='(mission, mission_it) in list.data'
                :key='mission_it'
                class='cursor-pointer col-12 py-2 hover-dark'
                @click='$router.push(`/menu/missions/${mission.name}`)'
            >
                <div class='px-3 d-flex'>
                    <div class='d-flex justify-content-center align-items-center'>
                        <IconLock
                            v-if='mission.passwordProtected'
                            size='32'
                        />
                        <IconLockOpen
                            v-else
                            size='32'
                        />
                    </div>
                    <div class='mx-2'>
                        <div class='col-12'>
                            <span v-text='mission.name' />
                        </div>
                        <div class='col-12'>
                            <span
                                class='text-secondary'
                                v-text='mission.createTime.replace(/T.*/, "")'
                            />
                            &nbsp;-&nbsp;
                            <span
                                class='text-secondary'
                                v-text='mission.contents.length + " Items"'
                            />
                        </div>
                    </div>
                    <div class='col-auto ms-auto align-items-center d-flex'>
                        <IconAccessPoint
                            v-if='subscribed.has(mission.guid)'
                            v-tooltip='"Subscribed"'
                            size='32'
                            class='text-green'
                        />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconAccessPoint,
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'MissionList',
    components: {
        TablerAlert,
        TablerNone,
        TablerLoading,
        IconCircleArrowLeft,
        IconAccessPoint,
        IconRefresh,
        IconPlus,
        IconLock,
        IconLockOpen
    },
    data: function() {
        return {
            err: false,
            loading: true,
            subscribed: new Set(),
            list: {
                data: [],
            }
        }
    },
    mounted: async function() {
        await this.fetchMissions();
    },
    methods: {
        fetchMissions: async function() {
            this.err = false;

            try {
                this.loading = true;
                const url = stdurl('/api/marti/mission');
                url.searchParams.append('passwordProtected', 'true');
                url.searchParams.append('defaultRole', 'true');
                this.list = await std(url);

                for (const item of this.list.data) {
                    if (mapStore.getLayerByMode('mission', item.guid)) {
                        this.subscribed.add(item.guid);
                    }
                }
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        }
    }
}
</script>

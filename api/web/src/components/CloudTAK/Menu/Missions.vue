<template>
    <MenuTemplate
        name='Missions'
        :loading='loading'
        :none='!list.data.length'
    >
        <template #buttons>
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
        </template>
        <template #default>
            <TablerAlert
                v-if='err'
                :err='err'
            />
            <template v-else>
                <div
                    v-for='(mission, mission_it) in list.data'
                    :key='mission_it'
                    class='cursor-pointer col-12 py-2 hover-dark'
                    @click='$router.push(`/menu/missions/${mission.guid}`)'
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
        </template>
    </MenuTemplate>

    <TablerModal
        v-if='mode !== "list"'
        size='xl'
    >
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='mode = "list"'
        />
        <MissionCreate
            v-if='mode === "create"'
            @mission='mode = "list"'
            @chat='$emit("chat", $event)'
            @close='mode = "list"'
        />
    </TablerModal>
</template>

<script>
import MissionCreate from './Mission/MissionCreate.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerAlert,
    TablerModal
} from '@tak-ps/vue-tabler';
import { std, stdurl } from '/src/std.ts';
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconAccessPoint,
    IconRefresh,
} from '@tabler/icons-vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'CloudTAKMissions',
    components: {
        MenuTemplate,
        TablerAlert,
        TablerModal,
        MissionCreate,
        IconPlus,
        IconLock,
        IconLockOpen,
        IconAccessPoint,
        IconRefresh,
    },
    data: function() {
        return {
            mode: 'list',
            err: false,
            loading: true,
            subscribed: new Set(),
            list: {
                data: [],
            }
        };
    },
    watch: {
        mission: function() {
            this.mode = 'list';
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

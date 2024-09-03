<template>
    <MenuTemplate
        name='Mission Info'
        :back='false'
        :border='false'
    >
        <div class='my-2'>
            <div class='row g-0 mx-2'>
                <div class='col-12'>
                    <div class='datagrid-title'>
                        Created
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='mission.createTime.replace(/T/, " ").replace(/:[0-9]+\..*/, "") + " UTC"'
                    />
                </div>
                <div class='col-6'>
                    <div class='datagrid-title'>
                        Subscribers
                    </div>

                    <TablerLoading
                        v-if='loading.users'
                        :inline='true'
                    />
                    <div
                        class='datagrid-content'
                        v-text='subscriptions.length'
                    />
                </div>
                <div class='col-6'>
                    <div class='datagrid-title'>
                        Contents
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='Array.isArray(mission.content) ? mission.contents.length : 0 + " Items"'
                    />
                </div>
                <div class='col-12'>
                    <div class='datagrid-title'>
                        Groups (Channels)
                    </div>
                    <div
                        v-for='group of mission.groups'
                        class='datagrid-content'
                    >
                        <span v-text='group' />
                    </div>
                </div>
                <div class='col-12'>
                    <div class='datagrid-title'>
                        Keywords
                    </div>
                    <div
                        class='datagrid-content'
                    >
                        <template v-if='mission.keywords.length'>
                            <span
                                v-for='keyword of mission.keywords'
                                v-text='keyword'
                            />
                        </template>
                        <span v-else>None</span>
                    </div>
                </div>
                <div class='col-12'>
                    <div class='datagrid-title'>
                        Description
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='mission.description || "No Feed Description"'
                    />
                </div>
                <div class='col-12'>
                    <div class='datagrid-title'>
                        Subscription
                    </div>
                    <button
                        v-if='subscribed === false'
                        class='btn btn-green'
                        style='height: 32px;'
                        @click='subscribe(true)'
                    >
                        Subscribe
                    </button>
                    <button
                        v-else-if='subscribed === true'
                        class='btn btn-danger'
                        style='height: 32px;'
                        @click='subscribe(false)'
                    >
                        Unsubscribe
                    </button>
                    <TablerLoading
                        v-else
                        :inline='true'
                        desc='Updating Subscription...'
                    />
                </div>
            </div>
        </div>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import Overlay from '/src/stores/overlays/base.ts';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'MissionInfo',
    components: {
        MenuTemplate,
        TablerLoading
    },
    props: {
        mission: Object,
        token: String,
        role: Object,
    },
    data: function() {
        return {
            createLayer: false,
            loading: {
                users: false,
                layers: true,
                subscribe: false,
            },
            layers: [],
            subscriptions: []
        }
    },
    computed: {
        subscribed: function() {
            if (this.loading.subscribe) return;
            return !!mapStore.getOverlayByMode('mission', this.mission.guid);
        }
    },
    mounted: async function() {
        await this.fetchSubscriptions();
    },
    methods: {
        fetchSubscriptions: async function() {
            const url = stdurl(`/api/marti/missions/${this.mission.name}/subscriptions/roles`);
            this.subscriptions = (await std(url, {
                headers: {
                    MissionAuthorization: this.token
                }
            })).data;
            this.loading.users = false;
        },
        subscribe: async function(subscribed) {
            this.loading.subscribe = true;
            const overlay = mapStore.getOverlayByMode('mission', this.mission.guid);

            if (subscribed === true && !overlay) {
                const missionOverlay = await Overlay.create(mapStore.map, {
                    name: this.mission.name,
                    url: `/mission/${encodeURIComponent(this.mission.name)}`,
                    type: 'geojson',
                    mode: 'mission',
                    token: this.token,
                    mode_id: this.mission.guid,
                })

                mapStore.overlays.push(missionOverlay);

                mapStore.map.getSource(String(missionOverlay.id))
                    .setData(await cotStore.loadMission(this.mission.guid));
            } else if (subscribed === false && overlay) {
                await mapStore.removeOverlay(overlay);
            }

            this.loading.subscribe = false;
        },
    }
}
</script>

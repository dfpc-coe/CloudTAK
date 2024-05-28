<template>
    <MenuTemplate
        name='Mission Info'
        :back='false'
        :border='false'
    >
        <div class='mx-2 my-2'>
            <div class='row g-3'>
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
                <div class='col-12'>
                    <div class='datagrid-title'>
                        Mission Layers
                    </div>
                    <TablerLoading
                        v-if='loading.layers'
                        :inline='true'
                        desc='Loading Layers...'
                    />
                    <TablerNone
                        v-else-if='!layers.length'
                        :create='false'
                        :compact='true'
                        label='Layers'
                    />
                    <template v-else>
                        <div
                            v-for='layer in layers'
                            class='col-12'
                        >
                            <span v-text='layer.name' />
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'MissionInfo',
    components: {
        MenuTemplate,
        TablerNone,
        TablerLoading
    },
    props: {
        mission: Object,
    },
    data: function() {
        return {
            subscribed: !!mapStore.getLayerByMode('mission', this.mission.guid),
            loading: {
                users: false,
                layers: true
            },
            layers: [],
            subscriptions: []
        }
    },
    mounted: async function() {
        await this.fetchSubscriptions();
        await this.fetchLayers();
    },
    methods: {
        fetchSubscriptions: async function() {
            const url = await stdurl(`/api/marti/missions/${this.mission.name}/subscriptions/roles`);
            this.subscriptions = (await std(url)).data;
            this.loading.users = false;
        },
        fetchLayers: async function() {
            this.loading.layers = true;
            const url = await stdurl(`/api/marti/missions/${this.mission.name}/layer`);
            this.layers = (await std(url)).data;
            this.loading.layers = false;
        },
        subscribe: async function(subscribed) {
            this.subscribed = null;

            const layer = mapStore.getLayerByMode('mission', this.mission.guid);

            if (subscribed === true && !layer) {
                await mapStore.addDefaultLayer({
                    id: this.mission.guid,
                    url: `/mission/${encodeURIComponent(this.mission.name)}`,
                    name: this.mission.name,
                    source: this.mission.guid,
                    type: 'geojson',
                    before: 'CoT Icons',
                    mode: 'mission',
                    mode_id: this.mission.guid,
                    clickable: [
                        { id: `${this.mission.guid}-poly`, type: 'feat' },
                        { id: `${this.mission.guid}-polyline`, type: 'feat' },
                        { id: `${this.mission.guid}-line`, type: 'feat' },
                        { id: this.mission.guid, type: 'feat' }
                    ]
                });
            } else if (subscribed === false && layer) {
                await mapStore.removeLayer(this.mission.name);
            }

            this.subscribed = !!mapStore.getLayerByMode('mission', this.mission.guid);
        },
    }
}
</script>

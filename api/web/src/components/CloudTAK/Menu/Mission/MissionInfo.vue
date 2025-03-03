<template>
    <MenuTemplate
        name='Mission Info'
        :zindex='0'
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
                        v-else
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
                    <template
                        v-else-if='subscribed === true'
                    >
                        <div class='btn-list'>
                            <button
                                class='btn btn-danger'
                                style='height: 32px;'
                                @click='subscribe(false)'
                            >
                                Unsubscribe
                            </button>

                            <button
                                v-if='mapStore.mission !== props.mission.guid'
                                class='btn btn-green'
                                style='height: 32px;'
                                @click='mapStore.mission = props.mission.guid'
                            >
                                Make Active
                            </button>
                            <button
                                v-else
                                class='btn btn-muted'
                                style='height: 32px;'
                                @click='mapStore.mission = undefined'
                            >
                                Deactivate
                            </button>
                        </div>
                    </template>
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

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import type { MissionSubscriptions } from '../../../../types.ts'
import Subscription from '../../../../base/mission.ts';
import {
    TablerLoading,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import Overlay from '../../../../stores/base/overlay.ts';
import { useMapStore } from '../../../../stores/map.ts';
const mapStore = useMapStore();

const props = defineProps({
    mission: {
        type: Object,
        required: true
    },
    token: String,
    role: {
        type: Object,
        required: true
    }
});

onMounted(async () => {
    await fetchSubscriptions();
});

const loading = ref({
    users: false,
    subscribe: false,
});

const subscriptions = ref<MissionSubscriptions>([])

const subscribed = computed(() => {
    if (loading.value.subscribe) return;
    return !!mapStore.getOverlayByMode('mission', props.mission.guid);
});

async function fetchSubscriptions() {
    loading.value.users = true;
    subscriptions.value = await Subscription.subscriptions(props.mission.guid, props.token)
    loading.value.users = false;
}

async function subscribe(subscribed: boolean) {
    loading.value.subscribe = true;
    const overlay = mapStore.getOverlayByMode('mission', props.mission.guid);

    if (subscribed === true && !overlay) {
        const missionOverlay = await Overlay.create(mapStore.map, {
            name: props.mission.name,
            url: `/mission/${encodeURIComponent(props.mission.name)}`,
            type: 'geojson',
            mode: 'mission',
            token: props.token,
            mode_id: props.mission.guid,
        })

        mapStore.overlays.push(missionOverlay);
        await mapStore.loadMission(props.mission.guid);
    } else if (subscribed === false && overlay) {
        await mapStore.removeOverlay(overlay);
    }

    loading.value.subscribe = false;
}
</script>

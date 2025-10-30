<template>
    <MenuTemplate
        name='Mission Info'
        :zindex='0'
        :back='false'
        :border='false'
    >
        <div class='my-2'>
            <div class='row g-2 mx-2'>
                <div class='col-12'>
                    <div class='datagrid-title user-select-none'>
                        Created
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='props.subscription.meta.createTime.replace(/T/, " ").replace(/:[0-9]+\..*/, "") + " UTC"'
                    />
                </div>
                <div class='col-6'>
                    <div class='datagrid-title user-select-none'>
                        Subscribers
                    </div>

                    <TablerLoading
                        v-if='loading.users'
                        :inline='true'
                    />
                    <div
                        v-else
                        class='datagrid-content'
                        v-text='subscriptions.length + " Users"'
                    />
                </div>
                <div class='col-6'>
                    <div class='datagrid-title user-select-none'>
                        Contents
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='(Array.isArray(props.subscription.meta.contents) ? props.subscription.meta.contents.length : 0) + " Files"'
                    />
                </div>
                <div class='col-12'>
                    <div class='datagrid-title user-select-none'>
                        Groups (Channels)
                    </div>
                    <div
                        v-for='group of props.subscription.meta.groups'
                        class='datagrid-content'
                    >
                        <span v-text='group' />
                    </div>
                </div>
                <div class='col-12'>
                    <div class='datagrid-title user-select-none'>
                        Keywords
                    </div>
                    <div
                        class='datagrid-content'
                    >
                        <template v-if='props.subscription.meta.keywords.length'>
                            <span
                                v-for='keyword of props.subscription.meta.keywords'
                                v-text='keyword'
                            />
                        </template>
                        <span v-else>None</span>
                    </div>
                </div>
                <div class='col-12'>
                    <div class='datagrid-title user-select-none'>
                        Description
                    </div>
                    <div
                        class='datagrid-content'
                        v-text='props.subscription.meta.description || "No Feed Description"'
                    />
                </div>
                <div class='col-12 row g-2'>
                    <div class='datagrid-title user-select-none'>
                        Subscription
                    </div>

                    <TablerLoading
                        v-if='loading.subscribe'
                        :inline='true'
                        desc='Updating Subscription...'
                    />
                    <div
                        v-else-if='props.subscription.subscribed === false'
                        class='col-12'
                    >
                        <button
                            class='btn btn-green w-100'
                            style='height: 32px;'
                            @click='subscribe(true)'
                        >
                            Subscribe
                        </button>
                    </div>
                    <template
                        v-else-if='props.subscription.subscribed === true'
                    >
                        <div class='col-6'>
                            <button
                                class='btn btn-danger w-100'
                                style='height: 32px;'
                                @click='subscribe(false)'
                            >
                                Unsubscribe
                            </button>
                        </div>
                        <div class='col-6'>
                            <button
                                v-if='!mapStore.mission || mapStore.mission.meta.guid !== props.subscription.meta.guid'
                                :disabled='!props.subscription.role.permissions.includes("MISSION_WRITE")'
                                class='btn btn-green w-100'
                                style='height: 32px;'
                                @click='mapStore.makeActiveMission(props.subscription)'
                            >
                                Make Active
                            </button>
                            <button
                                v-else
                                class='btn btn-muted w-100'
                                :disabled='!props.subscription.role.permissions.includes("MISSION_WRITE")'
                                style='height: 32px;'
                                @click='mapStore.makeActiveMission()'
                            >
                                Deactivate
                            </button>
                        </div>
                    </template>
                </div>
                <div class='col-12 pt-3'>
                    <div class='datagrid-title user-select-none'>
                        Tools
                    </div>
                    <div class='btn-list'>
                        <TablerIconButton
                            title='Invite QR Code'
                            @click='showQR = true'
                        >
                            <IconQrcode
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
            </div>
        </div>
    </MenuTemplate>

    <TablerModal
        v-if='showQR'
        size='lg'
    >
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='showQR = false'
        />
        <div class='modal-header text-white'>
            <div class='d-flex align-items-center'>
                <IconQrcode
                    :size='28'
                    stroke='1'
                />
                <span
                    class='mx-2'
                    v-text='props.subscription.meta.name + " Invite QR"'
                />
            </div>
        </div>
        <div class='modal-body'>
            <div class='col-12'>
                <img
                    :src='missionQRURL'
                    style='
                        filter: invert(100%);
                    '
                >
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed } from 'vue';
import type { MissionSubscriptions } from '../../../../types.ts';
import { stdurl } from '../../../../std.ts'
import Subscription from '../../../../base/subscription.ts';
import {
    IconQrcode
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerIconButton,
    TablerModal,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import Overlay from '../../../../base/overlay.ts';
import { useMapStore } from '../../../../stores/map.ts';
const mapStore = useMapStore();

const emit = defineEmits(['refresh']);

const props = defineProps<{
    subscription: Subscription
}>();

const missionQRURL = computed(() => {
    return String(stdurl(`/api/marti/missions/${props.subscription.guid}/qr?token=${localStorage.token}`));
});

const showQR = ref(false);

const subscriptions = ref<MissionSubscriptions>([])

onMounted(async () => {
    loading.value.users = true;
    await fetchSubscriptions();
    loading.value.users = false;
});

const loading = ref({
    users: false,
    subscribe: false,
});

async function fetchSubscriptions() {
    loading.value.users = true;
    subscriptions.value = await props.subscription.subscriptions();
    loading.value.users = false;
}

async function subscribe(subscribe: boolean) {
    loading.value.subscribe = true;
    const overlay = mapStore.getOverlayByMode('mission', props.subscription.guid);

    if (subscribe === true && !overlay) {
        const missionOverlay = await Overlay.create({
            name: props.subscription.name,
            url: `/mission/${encodeURIComponent(props.subscription.guid)}`,
            type: 'geojson',
            mode: 'mission',
            token: props.subscription.missiontoken,
            mode_id: props.subscription.guid,
        })

        mapStore.overlays.push(missionOverlay);
        await mapStore.loadMission(props.subscription.guid);

        emit('refresh');
    } else if (subscribe === false && overlay) {
        await mapStore.removeOverlay(overlay);

        emit('refresh');
    }

    await props.subscription.update({ subscribed: subscribe });

    loading.value.subscribe = false;
}
</script>

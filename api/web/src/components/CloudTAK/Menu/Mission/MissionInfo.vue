<template>
    <MenuTemplate
        name='Mission Info'
        :zindex='0'
        :back='false'
        :border='false'
    >
        <div class='container-fluid px-2 px-sm-3'>
            <div class='row gy-3 gx-0 gx-lg-3'>
                <div class='col-12'>
                    <div class='card h-100 bg-dark text-white border border-light-subtle shadow-sm'>
                        <div class='card-body d-flex flex-column gap-4'>
                            <div class='d-flex align-items-center gap-3'>
                                <div class='rounded-circle bg-primary-subtle text-primary-emphasis p-1 d-flex align-items-center justify-content-center'>
                                    <IconBroadcast
                                        :size='32'
                                        stroke='1'
                                    />
                                </div>
                                <div class='flex-grow-1'>
                                    <p class='text-uppercase text-white-50 small mb-1'>
                                        Mission
                                    </p>
                                    <h2
                                        class='h4 mb-0 text-truncate'
                                        style='max-width: calc(100% - 48px);'
                                        v-text='props.subscription.name'
                                    />
                                </div>
                            </div>

                            <div class='row gy-3 gx-0 gx-sm-3'>
                                <div class='col-12 col-lg-6'>
                                    <small class='text-uppercase text-white-50 d-block'>Created</small>
                                    <p class='text-white fw-semibold p-0 mb-0'>
                                        {{ props.subscription.meta.createTime.replace(/T/, " ").replace(/:[0-9]+\..*/, "") + " UTC" }}
                                    </p>
                                </div>
                                <div class='col-12 col-lg-6'>
                                    <small class='text-uppercase text-white-50 d-block'>Subscribers</small>
                                    <TablerLoading
                                        v-if='loading.users'
                                        :inline='true'
                                    />
                                    <p
                                        v-else
                                        class='text-white fw-semibold p-0 mb-0'
                                        v-text='subscriptions.length + " Users"'
                                    />
                                </div>
                                <div class='col-12'>
                                    <small class='text-uppercase text-white-50 d-block mb-1'>Contents</small>
                                    <p
                                        class='text-white fw-semibold mb-0'
                                        v-text='(Array.isArray(props.subscription.meta.contents) ? props.subscription.meta.contents.length : 0) + " Files"'
                                    />
                                </div>
                                <div class='col-12'>
                                    <small class='text-uppercase text-white-50 d-block mb-1'>Groups (Channels)</small>
                                    <div
                                        v-if='props.subscription.meta.groups && props.subscription.meta.groups.length'
                                        class='d-flex flex-wrap gap-2'
                                    >
                                        <span
                                            v-for='group of props.subscription.meta.groups'
                                            :key='group'
                                            class='badge rounded-pill text-bg-secondary text-uppercase fw-semibold'
                                            v-text='group'
                                        />
                                    </div>
                                    <p
                                        v-else
                                        class='text-white-50 mb-0'
                                    >
                                        None
                                    </p>
                                </div>
                                <div class='col-12'>
                                    <small class='text-uppercase text-white-50 d-block mb-2'>Keywords</small>
                                    <Keywords :keywords='props.subscription.meta.keywords' />
                                    <p
                                        v-if='!props.subscription.meta.keywords.length'
                                        class='text-white-50 mb-0'
                                    >
                                        None
                                    </p>
                                </div>
                                <div class='col-12'>
                                    <small class='text-uppercase text-white-50 d-block mb-1'>Description</small>
                                    <CopyField
                                        :model-value='props.subscription.meta.description'
                                        :edit='props.subscription.subscribed && props.subscription.role.permissions.includes("MISSION_WRITE")'
                                        :rows='5'
                                        @submit='updateDescription($event)'
                                    >
                                        <span
                                            v-if='!props.subscription.meta.description'
                                            class='text-white-50 fst-italic'
                                        >No Feed Description</span>
                                    </CopyField>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class='col-12'>
                    <div class='card h-100 bg-dark text-white border border-light-subtle shadow-sm'>
                        <div class='card-body d-flex flex-column gap-3'>
                            <p class='text-uppercase text-white-50 small mb-1'>
                                Quick Actions
                            </p>

                            <TablerLoading
                                v-if='loading.subscribe'
                                :inline='true'
                                desc='Updating Subscription...'
                            />
                            <template v-else>
                                <button
                                    v-if='props.subscription.subscribed === false'
                                    class='btn btn-success w-100 d-flex align-items-center justify-content-center gap-2'
                                    @click='subscribe(true)'
                                >
                                    <IconPlus
                                        :size='20'
                                        stroke='1'
                                    />
                                    <span>Subscribe</span>
                                </button>
                                <template v-else>
                                    <button
                                        class='btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2'
                                        @click='subscribe(false)'
                                    >
                                        <IconMinus
                                            :size='20'
                                            stroke='1'
                                        />
                                        <span>Unsubscribe</span>
                                    </button>

                                    <button
                                        v-if='!mapStore.mission || mapStore.mission.meta.guid !== props.subscription.meta.guid'
                                        :disabled='!props.subscription.role.permissions.includes("MISSION_WRITE")'
                                        class='btn btn-success w-100 d-flex align-items-center justify-content-center gap-2'
                                        @click='mapStore.makeActiveMission(props.subscription)'
                                    >
                                        <IconCheck
                                            :size='20'
                                            stroke='1'
                                        />
                                        <span>Make Active</span>
                                    </button>
                                    <button
                                        v-else
                                        class='btn btn-secondary w-100 d-flex align-items-center justify-content-center gap-2'
                                        :disabled='!props.subscription.role.permissions.includes("MISSION_WRITE")'
                                        @click='mapStore.makeActiveMission()'
                                    >
                                        <IconX
                                            :size='20'
                                            stroke='1'
                                        />
                                        <span>Deactivate</span>
                                    </button>
                                </template>
                            </template>

                            <button
                                class='btn btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2'
                                @click='showQR = true'
                            >
                                <IconQrcode
                                    :size='20'
                                    stroke='1'
                                />
                                <span>Invite QR Code</span>
                            </button>
                        </div>
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
import Keywords from '../../util/Keywords.vue';
import CopyField from '../../util/CopyField.vue';
import {
    IconQrcode,
    IconBroadcast,
    IconPlus,
    IconMinus,
    IconCheck,
    IconX
} from '@tabler/icons-vue';
import {
    TablerLoading,
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

async function updateDescription(description: string) {
    try {
        await props.subscription.update({ description });
    } catch (err) {
        console.error(err);
    }
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
        if (mapStore.mission && mapStore.mission.meta.guid === props.subscription.meta.guid) {
            mapStore.makeActiveMission();
        }

        await mapStore.removeOverlay(overlay);

        emit('refresh');
    }

    await props.subscription.update({ subscribed: subscribe });

    loading.value.subscribe = false;
}
</script>

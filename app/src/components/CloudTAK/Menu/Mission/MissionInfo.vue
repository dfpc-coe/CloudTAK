<template>
    <MenuTemplate
        name='Mission Info'
        :zindex='0'
        :back='false'
        :border='false'
        :standalone='false'
    >
        <div class='container-fluid px-2 px-sm-3'>
            <div class='row gy-3 gx-0 gx-lg-3'>
                <div
                    v-if='error'
                    class='col-12'
                >
                    <TablerAlert :err='error' />
                </div>
                <div class='col-12'>
                    <TablerBorder
                        class='cloudtak-accent'
                        gap='lg'
                    >
                        <div class='d-flex align-items-center gap-3'>
                            <div class='rounded-circle bg-primary-subtle text-primary-emphasis p-1 d-flex align-items-center justify-content-center'>
                                <img
                                    v-if='missionTemplate && missionTemplate.icon'
                                    :src='String(stdurl(missionTemplate.icon))'
                                    width='32'
                                    height='32'
                                    :title='missionTemplate.name'
                                >
                                <IconBroadcast
                                    v-else
                                    :size='32'
                                    stroke='1'
                                />
                            </div>
                            <div class='flex-grow-1'>
                                <p class='text-uppercase text-secondary small mb-1'>
                                    Mission
                                </p>
                                <h2
                                    class='h4 mb-0 text-truncate mission-name'
                                    style='max-width: calc(100% - 48px);'
                                    role='button'
                                    tabindex='0'
                                    title='Zoom to Mission Features'
                                    @click='zoomToFeatures'
                                    @keydown.enter.prevent='zoomToFeatures'
                                    v-text='props.subscription.name'
                                />
                            </div>
                        </div>

                        <div class='row gy-3 gx-0 gx-sm-3'>
                            <div class='col-12 col-lg-6'>
                                <small class='text-uppercase text-secondary d-block'>Created</small>
                                <p class='fw-semibold p-0 mb-0'>
                                    {{ props.subscription.meta.createTime.replace(/T/, " ").replace(/:[0-9]+\..*/, "") + " UTC" }}
                                </p>
                            </div>
                            <div class='col-12 col-lg-6'>
                                <small class='text-uppercase text-secondary d-block'>Subscribers</small>
                                <TablerLoading
                                    v-if='loading.users'
                                    :inline='true'
                                />
                                <p
                                    v-else-if='isOffline'
                                    class='fw-semibold p-0 mb-0'
                                >
                                    —
                                </p>
                                <p
                                    v-else
                                    class='fw-semibold p-0 mb-0'
                                    v-text='subscriptions.length + " Users"'
                                />
                            </div>
                            <div class='col-12'>
                                <small class='text-uppercase text-secondary d-block mb-1'>Contents</small>
                                <p
                                    class='fw-semibold mb-0'
                                    v-text='(Array.isArray(props.subscription.meta.contents) ? props.subscription.meta.contents.length : 0) + " Files"'
                                />
                            </div>
                            <InlineGroupSelect
                                v-model='groupDraft'
                                :value='groupList'
                                :editing='editingGroups'
                                :editable='canEditGroups'
                                :saving='savingGroups'
                                border-class='mission-editable-border'
                                label='Groups (Channels)'
                                @edit='startEditingGroups'
                                @cancel='cancelEditingGroups'
                                @save='saveGroups'
                            />
                            <InlineKeywords
                                v-model='keywordDraft'
                                :value='keywords'
                                :editing='editingKeywords'
                                :editable='canEditMission'
                                :saving='savingKeywords'
                                border-class='mission-editable-border'
                                label='Keywords'
                                placeholder='No keywords provided'
                                input-placeholder='Add keywords'
                                tone='accent'
                                @edit='startEditingKeywords'
                                @cancel='cancelEditingKeywords'
                                @save='saveKeywords'
                            />
                            <div class='col-12'>
                                <small class='text-uppercase text-secondary d-block mb-1'>Description</small>
                                <CopyField
                                    :model-value='props.subscription.meta.description'
                                    :edit='props.subscription.subscribed && props.subscription.role.permissions.includes("MISSION_WRITE")'
                                    :rows='5'
                                    @submit='updateDescription($event)'
                                >
                                    <span
                                        v-if='!props.subscription.meta.description'
                                        class='text-secondary fst-italic'
                                    >No Feed Description</span>
                                </CopyField>
                            </div>
                        </div>
                    </TablerBorder>
                </div>

                <div class='col-12'>
                    <TablerBorder class='cloudtak-accent'>
                        <template #label>
                            <p class='text-uppercase text-secondary small mb-0'>
                                Access
                            </p>
                        </template>
                        <div class='row gy-3 gx-0 gx-sm-3'>
                            <div class='col-12 col-lg-6'>
                                <small class='text-uppercase text-secondary d-block mb-1'>Default Role</small>
                                <div
                                    v-if='canSetDefaultRole'
                                    class='d-flex align-items-center gap-2'
                                >
                                    <select
                                        v-model='defaultRoleDraft'
                                        class='form-select form-select-sm'
                                        style='width: auto;'
                                        :disabled='saving.access'
                                    >
                                        <option
                                            v-for='option of roleOptions'
                                            :key='option.value'
                                            :value='option.value'
                                        >
                                            {{ option.label }}
                                        </option>
                                    </select>
                                    <button
                                        v-if='defaultRoleDraft && defaultRoleDraft !== currentDefaultRole'
                                        class='btn btn-sm btn-primary'
                                        :disabled='saving.access'
                                        @click='saveDefaultRole'
                                    >
                                        Save
                                    </button>
                                </div>
                                <p
                                    v-else
                                    class='fw-semibold p-0 mb-0'
                                    v-text='defaultRoleLabel'
                                />
                                <small class='text-secondary'>Role given to anyone who subscribes without an explicit role</small>
                            </div>
                            <div class='col-12 col-lg-6'>
                                <small class='text-uppercase text-secondary d-block mb-1'>Password</small>
                                <p class='fw-semibold p-0 mb-1 d-flex align-items-center gap-2'>
                                    <IconLock
                                        v-if='passwordProtected'
                                        :size='18'
                                        stroke='1'
                                    />
                                    <IconLockOpen
                                        v-else
                                        :size='18'
                                        stroke='1'
                                    />
                                    <span v-text='passwordProtected ? "Password protected" : "No password"' />
                                </p>
                                <template v-if='canSetPassword'>
                                    <div
                                        v-if='editingPassword'
                                        class='d-flex flex-column gap-2'
                                    >
                                        <TablerInput
                                            v-model='passwordDraft'
                                            type='password'
                                            autocomplete='new-password'
                                            label='New Password'
                                        />
                                        <div class='d-flex gap-2'>
                                            <button
                                                class='btn btn-sm btn-primary'
                                                :disabled='!passwordDraft || saving.access'
                                                @click='savePassword'
                                            >
                                                Save
                                            </button>
                                            <button
                                                class='btn btn-sm'
                                                :disabled='saving.access'
                                                @click='cancelEditingPassword'
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        v-else
                                        class='d-flex align-items-center gap-2'
                                    >
                                        <button
                                            class='btn btn-sm'
                                            :disabled='saving.access'
                                            @click='editingPassword = true'
                                            v-text='passwordProtected ? "Change Password" : "Set Password"'
                                        />
                                        <TablerDelete
                                            v-if='passwordProtected'
                                            label='Remove Password'
                                            displaytype='icon'
                                            @delete='removePassword'
                                        />
                                    </div>
                                </template>
                            </div>
                        </div>
                    </TablerBorder>
                </div>
                <div class='col-12'>
                    <TablerBorder class='cloudtak-accent'>
                        <template #label>
                            <p class='text-uppercase text-secondary small mb-0'>
                                Quick Actions
                            </p>
                        </template>

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
                            class='btn w-100 d-flex align-items-center justify-content-center gap-2 invite-qr-btn'
                            @click='showQR = true'
                        >
                            <IconQrcode
                                :size='20'
                                stroke='1'
                            />
                            <span>Invite QR Code</span>
                        </button>
                    </TablerBorder>
                </div>

                <div class='col-12'>
                    <TablerBorder class='cloudtak-accent'>
                        <template #label>
                            <p class='text-uppercase text-secondary small mb-0'>
                                Child Missions
                            </p>
                        </template>
                        <TablerNone
                            :compact='true'
                            :create='false'
                        />
                    </TablerBorder>
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
        <div class='modal-header invite-qr-header'>
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
        <div class='modal-body invite-qr-body'>
            <div class='col-12 text-center'>
                <TablerLoading
                    v-if='qr.loading'
                    desc='Loading QR Code...'
                />
                <TablerAlert
                    v-else-if='qr.error'
                    :err='qr.error'
                />
                <div
                    v-else-if='qr.url'
                    class='invite-qr-frame'
                >
                    <img
                        :src='qr.url'
                        class='invite-qr-image img-fluid'
                        alt='Invite QR Code'
                    >
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import type { MissionSubscriptions, MissionRoleType } from '../../../../types.ts';
import { useRoute, useRouter } from 'vue-router';
import { stdurl, getRuntimeToken, bearer, fetchWithTimeout } from '../../../../std.ts'
import Subscription from '../../../../base/subscription.ts';
import MissionTemplate from '../../../../base/mission-template.ts';
import CopyField from '../../util/CopyField.vue';
import InlineGroupSelect from '../../util/InlineGroupSelect.vue';
import InlineKeywords from '../../util/InlineKeywords.vue';
import {
    IconQrcode,
    IconBroadcast,
    IconPlus,
    IconMinus,
    IconCheck,
    IconX,
    IconLock,
    IconLockOpen,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerBorder,
    TablerDelete,
    TablerInput,
    TablerLoading,
    TablerModal,
    TablerNone,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import OverlayManager from '../../../../base/overlay.ts';
import { useMapStore } from '../../../../stores/map.ts';
import { useDeviceStore } from '../../../../stores/device.ts';
const mapStore = useMapStore();
const deviceStore = useDeviceStore();
const isOffline = computed(() => !deviceStore.network.isOnline);

const emit = defineEmits(['subscribed']);

const props = defineProps<{
    subscription: Subscription
}>();
const error = ref<Error | undefined>(undefined);

function fail(err: unknown): void {
    error.value = err instanceof Error ? err : new Error(String(err));
}

const qr = ref<{ url?: string; loading: boolean; error?: Error }>({ loading: false });

function releaseQR(): void {
    if (qr.value.url) URL.revokeObjectURL(qr.value.url);
    qr.value = { loading: false };
}

/**
 * Fetch the invite QR code through a normal request instead of an <img src>.
 * An <img> cannot send the MissionAuthorization header, so a password protected
 * Data Sync was refused with 403. It also keeps the login token out of the URL.
 */
async function loadQR(): Promise<void> {
    releaseQR();
    qr.value = { loading: true };

    try {
        const token = await getRuntimeToken();
        const res = await fetchWithTimeout(20000)(
            stdurl(`/api/marti/missions/${encodeURIComponent(props.subscription.guid)}/qr`),
            { headers: { ...bearer(token), ...props.subscription.headers() } },
        );

        if (!res.ok) {
            let message = `Failed to load QR code (${res.status})`;
            try {
                const body = await res.json() as { message?: string };
                if (body.message) message = body.message;
            } catch {
                // Not a JSON error body, keep the status message
            }
            throw new Error(message);
        }

        qr.value = { url: URL.createObjectURL(await res.blob()), loading: false };
    } catch (err) {
        qr.value = { loading: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

const keywords = computed(() => {
    if (!Array.isArray(props.subscription.meta.keywords)) return [];
    return props.subscription.meta.keywords
        .map((keyword) => typeof keyword === 'string' ? keyword.trim() : '')
        .filter((keyword): keyword is string => keyword.length > 0)
        .filter((keyword) => !keyword.startsWith('template:'));
});

const canEditMission = computed(() => {
    return props.subscription.subscribed && props.subscription.role.permissions.includes('MISSION_WRITE');
});

const canEditGroups = computed(() => {
    return props.subscription.role.type === 'MISSION_OWNER';
});

function hasPermission(permission: string): boolean {
    return props.subscription.role.type === 'MISSION_OWNER'
        || props.subscription.role.permissions.includes(permission);
}
const canSetDefaultRole = computed(() => hasPermission('MISSION_SET_ROLE'));
const canSetPassword = computed(() => hasPermission('MISSION_SET_PASSWORD'));
const roleOptions: Array<{ value: MissionRoleType, label: string }> = [
    { value: 'MISSION_OWNER', label: 'Owner' },
    { value: 'MISSION_SUBSCRIBER', label: 'Subscriber' },
    { value: 'MISSION_READONLY_SUBSCRIBER', label: 'Read Only' },
];
const currentDefaultRole = computed<MissionRoleType | undefined>(() => props.subscription.meta.defaultRole?.type);
const defaultRoleLabel = computed(() => {
    return roleOptions.find((option) => option.value === currentDefaultRole.value)?.label || 'Unknown';
});
const passwordProtected = computed(() => !!props.subscription.meta.passwordProtected);
const defaultRoleDraft = ref<MissionRoleType | undefined>(currentDefaultRole.value);
watch(currentDefaultRole, (role) => {
    defaultRoleDraft.value = role;
});
const editingPassword = ref(false);
const passwordDraft = ref('');
async function saveDefaultRole(): Promise<void> {
    if (!defaultRoleDraft.value) return;
    try {
        saving.value.access = true;
        error.value = undefined;
        await props.subscription.update({ defaultRole: defaultRoleDraft.value });
    } catch (err) {
        defaultRoleDraft.value = currentDefaultRole.value;
        fail(err);
    } finally {
        saving.value.access = false;
    }
}
function cancelEditingPassword(): void {
    editingPassword.value = false;
    passwordDraft.value = '';
}
async function savePassword(): Promise<void> {
    if (!passwordDraft.value) return;
    try {
        saving.value.access = true;
        error.value = undefined;
        await props.subscription.update({ password: passwordDraft.value });
        cancelEditingPassword();
    } catch (err) {
        fail(err);
    } finally {
        saving.value.access = false;
    }
}
async function removePassword(): Promise<void> {
    try {
        saving.value.access = true;
        error.value = undefined;
        await props.subscription.update({ password: null });
    } catch (err) {
        fail(err);
    } finally {
        saving.value.access = false;
    }
}
const groupList = computed<string[]>(() => {
    const groups = props.subscription.meta.groups;
    if (!groups) return [];
    return Array.isArray(groups) ? groups : [groups];
});

const editingKeywords = ref(false);
const savingKeywords = ref(false);
const keywordDraft = ref<string[]>([...keywords.value]);

const editingGroups = ref(false);
const savingGroups = ref(false);
const groupDraft = ref<string[]>([...groupList.value]);

function startEditingGroups(): void {
    if (!canEditGroups.value) return;
    editingGroups.value = true;
}

function cancelEditingGroups(): void {
    editingGroups.value = false;
}

async function saveGroups(nextGroups: string[]): Promise<void> {
    try {
        savingGroups.value = true;
        error.value = undefined;
        groupDraft.value = [...nextGroups];
        await props.subscription.update({
            groups: nextGroups
        });
        editingGroups.value = false;
    } catch (err) {
        fail(err);
    } finally {
        savingGroups.value = false;
    }
}

function startEditingKeywords(): void {
    if (!canEditMission.value) return;
    editingKeywords.value = true;
}

function cancelEditingKeywords(): void {
    editingKeywords.value = false;
}

async function saveKeywords(nextKeywords: string[]): Promise<void> {
    try {
        savingKeywords.value = true;
        error.value = undefined;
        keywordDraft.value = [...nextKeywords];
        // Preserve any non-user keywords (eg template:*) that the Keywords component filters out
        const preserved = (props.subscription.meta.keywords || []).filter((keyword) => {
            return typeof keyword === 'string' && keyword.startsWith('template:');
        });
        await props.subscription.update({
            keywords: [...preserved, ...nextKeywords]
        });
        editingKeywords.value = false;
    } catch (err) {
        fail(err);
    } finally {
        savingKeywords.value = false;
    }
}

const showQR = ref(false);

watch(showQR, (open) => {
    if (open) {
        loadQR();
    } else {
        releaseQR();
    }
});

onUnmounted(releaseQR);

const route = useRoute();
const router = useRouter();

const subscriptions = ref<MissionSubscriptions>([]);
const missionTemplate = ref<MissionTemplate>();

onMounted(async () => {
    loading.value.users = true;
    await fetchSubscriptions();
    loading.value.users = false;

    if (props.subscription.templateid) {
        try {
            missionTemplate.value = await MissionTemplate.load(props.subscription.templateid);
        } catch (err) {
            console.error('Failed to load mission template', err);
        }
    }

    if (route.query.subscribe === 'true') {
        await subscribe(true);
        router.replace({
            query: {
                ...route.query,
                subscribe: undefined
            }
        });
    }
});

const loading = ref({
    users: false,
    subscribe: false,
});
const saving = ref({
    access: false,
});

async function fetchSubscriptions() {
    if (isOffline.value) return;
    loading.value.users = true;
    try {
        subscriptions.value = await props.subscription.subscriptions();
    } catch (err) {
        console.error(err);
    } finally {
        loading.value.users = false;
    }
}

async function zoomToFeatures(): Promise<void> {
    error.value = undefined;

    try {
        await props.subscription.feature.zoomTo();
    } catch (err) {
        fail(err);
    }
}

async function updateDescription(description: string) {
    error.value = undefined;

    try {
        await props.subscription.update({ description });
    } catch (err) {
        fail(err);
    }
}

async function subscribe(next: boolean) {
    loading.value.subscribe = true;
    error.value = undefined;

    try {
        const overlay = OverlayManager.loadedByMode('mission', props.subscription.guid);

        if (next === true && !overlay) {
            const created = await OverlayManager.createLoaded({
                name: props.subscription.name,
                url: `/mission/${encodeURIComponent(props.subscription.guid)}`,
                type: 'geojson',
                mode: 'mission',
                token: props.subscription.missiontoken,
                mode_id: props.subscription.guid,
            });

            try {
                await props.subscription.update({ subscribed: true });
            } catch (err) {
                await OverlayManager.deleteLoaded(created).catch(() => undefined);
                throw err;
            }
        } else if (next === false && overlay) {
            if (mapStore.mission && mapStore.mission.meta.guid === props.subscription.meta.guid) {
                await mapStore.makeActiveMission();
            }

            await OverlayManager.deleteLoaded(overlay);
            await props.subscription.update({ subscribed: false });
        } else {
            await props.subscription.update({ subscribed: next });
        }

        emit('subscribed');

        if (!next && props.subscription.meta.passwordProtected) {
            await router.push({ name: 'home-menu-missions' });
        }
    } catch (err) {
        fail(err);
    } finally {
        loading.value.subscribe = false;
    }
}
</script>

<style scoped>
.mission-name {
    cursor: pointer;
}

.mission-name:hover,
.mission-name:focus-visible {
    text-decoration: underline;
    outline: none;
}

.mission-editable-border:deep(.tabler-border__tools) {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
}

.mission-editable-border:hover:deep(.tabler-border__tools),
.mission-editable-border:focus-within:deep(.tabler-border__tools) {
    opacity: 1;
    pointer-events: auto;
}

.invite-qr-header {
    color: var(--tblr-body-color);
}

.invite-qr-body {
    display: flex;
    justify-content: center;
}

/* A QR code must be dark on a light background with a quiet zone of at least 4 modules,
   so it stays white in dark mode instead of being inverted */
/* The QR SVG only has a viewBox, so it has no size of its own: the frame needs a definite width */
.invite-qr-frame {
    box-sizing: border-box;
    width: min(100%, 420px);
    margin: 0 auto;
    padding: 2.5rem;
    background: #fff;
    border-radius: 0.5rem;
}
.invite-qr-image {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
}
@media (max-width: 576px) {
    .invite-qr-frame {
        padding: 1.5rem;
    }
}

:global(html[data-bs-theme='dark']) .invite-qr-btn {
    --bs-btn-color: rgba(255, 255, 255, 0.92);
    --bs-btn-border-color: rgba(255, 255, 255, 0.35);
    --bs-btn-hover-color: #182433;
    --bs-btn-hover-bg: rgba(255, 255, 255, 0.92);
    --bs-btn-hover-border-color: rgba(255, 255, 255, 0.92);
}

:global(html[data-bs-theme='light']) .invite-qr-btn {
    --bs-btn-color: var(--tblr-body-color);
    --bs-btn-border-color: var(--tblr-border-color);
    --bs-btn-hover-color: var(--tblr-bg-surface);
    --bs-btn-hover-bg: var(--tblr-primary);
    --bs-btn-hover-border-color: var(--tblr-primary);
}


</style>

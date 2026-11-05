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
                            <div class='col-12'>
                                <label
                                    class='subheader cursor-pointer d-flex align-items-center gap-1 mb-0'
                                    @click='advanced = !advanced'
                                >
                                    <IconSquareChevronRight
                                        v-if='!advanced'
                                        :size='24'
                                        stroke='1'
                                    />
                                    <IconChevronDown
                                        v-else
                                        :size='24'
                                        stroke='1'
                                    />
                                    Advanced
                                </label>
                            </div>
                            <template v-if='advanced'>
                                <div class='col-12'>
                                    <TablerBorder
                                        :class='["cloudtak-accent", canSetRole ? "mission-editable-border" : ""]'
                                        gap='sm'
                                    >
                                        <template #label>
                                            <small class='text-uppercase text-secondary d-block mb-0'>Default Subscriber Role</small>
                                        </template>
                                        <template
                                            v-if='canSetRole && !editingRole'
                                            #tools
                                        >
                                            <TablerIconButton
                                                title='Edit default role'
                                                @click.stop.prevent='startEditingRole'
                                            >
                                                <IconPencil
                                                    :size='24'
                                                    stroke='1'
                                                />
                                            </TablerIconButton>
                                        </template>
                                        <template
                                            v-else-if='editingRole'
                                            #tools
                                        >
                                            <div class='d-flex gap-1'>
                                                <TablerIconButton
                                                    :disabled='savingRole'
                                                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                                                    :title='savingRole ? "Saving..." : "Save"'
                                                    @click.stop='saveRole'
                                                >
                                                    <IconDeviceFloppy
                                                        color='rgb(var(--tblr-primary-rgb))'
                                                        stroke='1'
                                                    />
                                                </TablerIconButton>
                                                <TablerIconButton
                                                    :disabled='savingRole'
                                                    title='Cancel'
                                                    @click.stop='editingRole = false'
                                                >
                                                    <IconX stroke='1' />
                                                </TablerIconButton>
                                            </div>
                                        </template>

                                        <select
                                            v-if='editingRole'
                                            v-model='roleDraft'
                                            class='form-select form-select-sm'
                                            :disabled='savingRole'
                                        >
                                            <option
                                                v-for='option of roleOptions'
                                                :key='option.value'
                                                :value='option.value'
                                                v-text='option.label'
                                            />
                                        </select>
                                        <p
                                            v-else
                                            class='fw-semibold mb-0'
                                            v-text='roleLabel(defaultRole)'
                                        />
                                    </TablerBorder>
                                </div>
                                <div class='col-12'>
                                    <TablerBorder
                                        class='cloudtak-accent'
                                        gap='sm'
                                    >
                                        <template #label>
                                            <small class='text-uppercase text-secondary d-block mb-0'>Password</small>
                                        </template>
                                        <div class='d-flex align-items-center gap-2 flex-wrap'>
                                            <IconLock
                                                v-if='props.subscription.meta.passwordProtected'
                                                :size='20'
                                                stroke='1'
                                            />
                                            <IconLockOpen
                                                v-else
                                                :size='20'
                                                stroke='1'
                                            />
                                            <span
                                                class='fw-semibold flex-grow-1'
                                                v-text='props.subscription.meta.passwordProtected ? "Password protected" : "No password"'
                                            />
                                            <template v-if='canSetPassword'>
                                                <TablerLoading
                                                    v-if='savingPassword'
                                                    :inline='true'
                                                />
                                                <template v-else>
                                                    <button
                                                        class='btn btn-sm btn-secondary'
                                                        @click='openPasswordModal'
                                                        v-text='props.subscription.meta.passwordProtected ? "Change" : "Set Password"'
                                                    />
                                                    <button
                                                        v-if='props.subscription.meta.passwordProtected'
                                                        class='btn btn-sm btn-outline-danger'
                                                        @click='removePassword'
                                                    >
                                                        Remove
                                                    </button>
                                                </template>
                                            </template>
                                        </div>
                                    </TablerBorder>
                                </div>
                            </template>
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
                <img
                    :src='missionQRURL'
                    class='invite-qr-image img-fluid'
                    :style='appStore.resolvedTheme === "dark" ? { filter: "invert(1)" } : undefined'
                >
            </div>
        </div>
    </TablerModal>

    <TablerModal
        v-if='showPassword'
        size='sm'
    >
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            :disabled='savingPassword'
            @click='showPassword = false'
        />
        <div class='modal-header'>
            <div class='d-flex align-items-center'>
                <IconLock
                    :size='28'
                    stroke='1'
                />
                <span
                    class='mx-2'
                    v-text='props.subscription.meta.passwordProtected ? "Change Password" : "Set Password"'
                />
            </div>
        </div>
        <form
            class='modal-body'
            @submit.prevent='savePassword'
        >
            <TablerInput
                v-model='passwordDraft'
                type='password'
                autocomplete='new-password'
                label='Password'
                :disabled='savingPassword'
                :autofocus='true'
            />
            <div class='d-flex mt-3'>
                <button
                    type='submit'
                    class='btn btn-primary ms-auto'
                    :disabled='savingPassword || !passwordDraft.length'
                >
                    <TablerLoading
                        v-if='savingPassword'
                        :inline='true'
                    />
                    <span v-else>Save</span>
                </button>
            </div>
        </form>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed } from 'vue';
import { Preferences } from '@capacitor/preferences';
import type { MissionRoleType, MissionSubscriptions } from '../../../../types.ts';
import { useRoute, useRouter } from 'vue-router';
import { stdurl } from '../../../../std.ts'
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
    IconPencil,
    IconDeviceFloppy,
    IconLock,
    IconLockOpen,
    IconSquareChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerBorder,
    TablerIconButton,
    TablerInput,
    TablerLoading,
    TablerModal,
    TablerNone,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import OverlayManager from '../../../../base/overlay.ts';
import { useMapStore } from '../../../../stores/map.ts';
import { useDeviceStore } from '../../../../stores/device.ts';
import { useAppStore } from '../../../../stores/app.ts';
const mapStore = useMapStore();
const deviceStore = useDeviceStore();
const appStore = useAppStore();
const isOffline = computed(() => !deviceStore.network.isOnline);

const emit = defineEmits(['subscribed']);

const props = defineProps<{
    subscription: Subscription
}>();
const token = ref<string | null>(null);
const error = ref<Error | undefined>(undefined);

function fail(err: unknown): void {
    error.value = err instanceof Error ? err : new Error(String(err));
}

const missionQRURL = computed(() => {
    return String(stdurl(`/api/marti/missions/${props.subscription.guid}/qr${token.value ? `?token=${encodeURIComponent(token.value)}` : ''}`));
});

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

const groupList = computed<string[]>(() => {
    const groups = props.subscription.meta.groups;
    if (!groups) return [];
    return Array.isArray(groups) ? groups : [groups];
});

const roleOptions: Array<{ value: MissionRoleType; label: string }> = [
    { value: 'MISSION_OWNER', label: 'Owner' },
    { value: 'MISSION_SUBSCRIBER', label: 'Subscriber' },
    { value: 'MISSION_READONLY_SUBSCRIBER', label: 'Read Only' },
];

function roleLabel(role?: MissionRoleType): string {
    const option = roleOptions.find((option) => option.value === role);
    return option ? option.label : 'Unknown';
}

const defaultRole = computed<MissionRoleType | undefined>(() => {
    return props.subscription.meta.defaultRole?.type;
});

const canSetRole = computed(() => {
    return props.subscription.subscribed && props.subscription.role.permissions.includes('MISSION_SET_ROLE');
});

const canSetPassword = computed(() => {
    return props.subscription.subscribed && props.subscription.role.permissions.includes('MISSION_SET_PASSWORD');
});

const editingRole = ref(false);
const savingRole = ref(false);
const roleDraft = ref<MissionRoleType>(defaultRole.value || 'MISSION_SUBSCRIBER');

function startEditingRole(): void {
    if (!canSetRole.value) return;
    roleDraft.value = defaultRole.value || 'MISSION_SUBSCRIBER';
    editingRole.value = true;
}

async function saveRole(): Promise<void> {
    try {
        savingRole.value = true;
        error.value = undefined;
        if (roleDraft.value !== defaultRole.value) {
            await props.subscription.update({ defaultRole: roleDraft.value });
        }
        editingRole.value = false;
    } catch (err) {
        fail(err);
    } finally {
        savingRole.value = false;
    }
}

const advanced = ref(false);
const showPassword = ref(false);
const savingPassword = ref(false);
const passwordDraft = ref('');

function openPasswordModal(): void {
    passwordDraft.value = '';
    showPassword.value = true;
}

async function savePassword(): Promise<void> {
    if (!passwordDraft.value.length) return;

    try {
        savingPassword.value = true;
        error.value = undefined;
        await props.subscription.update({ password: passwordDraft.value });
        showPassword.value = false;
    } catch (err) {
        fail(err);
    } finally {
        passwordDraft.value = '';
        savingPassword.value = false;
    }
}

async function removePassword(): Promise<void> {
    try {
        savingPassword.value = true;
        error.value = undefined;
        await props.subscription.update({ password: null });
    } catch (err) {
        fail(err);
    } finally {
        savingPassword.value = false;
    }
}

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
const route = useRoute();
const router = useRouter();

const subscriptions = ref<MissionSubscriptions>([]);
const missionTemplate = ref<MissionTemplate>();

onMounted(async () => {
    token.value = (await Preferences.get({ key: 'token' })).value;

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

.invite-qr-image {
    max-width: min(100%, 420px);
    height: auto;
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

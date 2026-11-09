<template>
    <MenuTemplate
        name='Mission Subscribers'
        :back='false'
        :border='false'
        :loading='loading'
        :standalone='false'
    >
        <template #buttons>
            <TablerDropdown
                v-if='canInvite'
            >
                <TablerIconButton
                    title='Invite User'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <template #dropdown>
                    <div
                        class='px-2 py-2'
                        style='min-width: 250px;'
                    >
                        <span class='strong'>Invite User</span>
                        <TablerAlert
                            v-if='inviteError'
                            class='mt-2'
                            :err='inviteError'
                            @click.stop
                        />
                        <UserClientSelect
                            v-model='inviteUsername'
                            :input='true'
                            placeholder='Username'
                            :groups='typeof subscription.meta.groups === "string" ? [subscription.meta.groups] : subscription.meta.groups'
                            :exclude-uids='excludeUids'
                            :exclude-callsigns='excludeCallsigns'
                            @click.stop
                            @select='inviteUser($event)'
                        />
                        <button
                            class='btn btn-primary w-100 mt-2'
                            :disabled='!inviteUsername'
                            @click.stop='inviteUser()'
                        >
                            Invite
                        </button>
                    </div>
                </template>
            </TablerDropdown>
        </template>

        <div class='col-12 px-2 py-2'>
            <TablerInput
                v-model='filter'
                icon='search'
                placeholder='Filter'
            />
        </div>

        <Offline v-if='isOffline' />
        <template v-else>
            <TablerAlert
                v-if='userError'
                class='mx-2 mt-2'
                :err='userError'
            />
            <div
                v-if='invites.length'
                class='col-12 px-2 py-2'
            >
                <StandardItem
                    class='d-flex flex-column px-2 py-2'
                    @click='showInvites = !showInvites'
                >
                    <div class='d-flex align-items-center gap-2'>
                        <IconMail
                            :size='24'
                            stroke='1'
                        />
                        <span class='fw-bold'>Pending Invites</span>
                        <TablerBadge
                            class='rounded-pill small ms-auto'
                            background-color='var(--tblr-red-lt)'
                            border-color='var(--tblr-red)'
                            text-color='var(--tblr-red)'
                        >
                            {{ invites.length }}
                        </TablerBadge>
                        <IconChevronDown
                            v-if='!showInvites'
                            :size='20'
                            stroke='1'
                            class='ms-2'
                        />
                        <IconChevronUp
                            v-else
                            :size='20'
                            stroke='1'
                            class='ms-2'
                        />
                    </div>

                    <transition name='menu-overlays-fade'>
                        <div
                            v-if='showInvites'
                            class='mt-2 pt-2 px-3 rounded-3 border cloudtak-accent'
                            @click.stop
                        >
                            <div
                                v-for='invite in invites'
                                :key='invite.invitee'
                                class='d-flex align-items-center justify-content-between mb-2'
                            >
                                <div class='d-flex flex-column'>
                                    <div v-text='invite.invitee' />
                                    <div
                                        class='small text-muted'
                                        v-text='invite.role ? invite.role.name : "Unknown Role"'
                                    />
                                </div>
                                <TablerDelete
                                    label='Revoke Invite'
                                    displaytype='icon'
                                    @delete='removeInvite(invite)'
                                />
                            </div>
                        </div>
                    </transition>
                </StandardItem>
            </div>

            <TablerNone
                v-if='!filteredSubscriptions.length'
                :create='false'
                label='No Mission Subscribers'
            />
            <div
                v-for='sub of filteredSubscriptions'
                v-else
                :key='sub.clientUid'
                class='col-lg-12'
            >
                <Contact
                    :contact='toContact(sub)'
                    @chat='router.push(`/menu/chats/new?callsign=${$event.callsign}&uid=${$event.uid}`)'
                >
                    <template
                        v-if='canInvite || canManageRoles'
                        #actions
                    >
                        <div class='d-flex align-items-center gap-2'>
                            <TablerIconButton
                                v-if='canManageRoles'
                                title='Edit User'
                                @click.stop='toggleEdit(sub.clientUid)'
                            >
                                <IconPencil
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerDelete
                                v-if='canManageRoles'
                                label='Remove User'
                                displaytype='icon'
                                @delete='removeUser(sub)'
                            />
                        </div>
                    </template>

                    <template
                        v-if='canManageRoles && editingUid === sub.clientUid'
                        #expanded
                    >
                        <div class='d-flex align-items-center gap-2'>
                            <select
                                class='form-select form-select-sm'
                                style='width: auto;'
                                :value='sub.role.type'
                                @change='changeRole(sub, ($event.target as HTMLSelectElement).value as MissionRoleType)'
                            >
                                <option value='MISSION_OWNER'>
                                    Owner
                                </option>
                                <option value='MISSION_SUBSCRIBER'>
                                    Subscriber
                                </option>
                                <option value='MISSION_READONLY_SUBSCRIBER'>
                                    Read Only
                                </option>
                            </select>
                        </div>
                    </template>
                </Contact>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { TablerAlert, TablerBadge, TablerNone, TablerInput, TablerDropdown, TablerIconButton, TablerDelete } from '@tak-ps/vue-tabler';
import { IconPlus, IconMail, IconChevronDown, IconChevronUp, IconPencil } from '@tabler/icons-vue';
import type { MissionSubscriptions, Contact as ContactType, MissionInvite, MissionRoleType } from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import StandardItem from '../../util/StandardItem.vue';
import UserClientSelect from '../../util/UserClientSelect.vue';
import Contact from '../../util/Contact.vue';
import Offline from '../../../util/Offline.vue';
import { useDeviceStore } from '../../../../stores/device.ts';

const props = defineProps<{
    subscription: Subscription
}>();

const router = useRouter();
const deviceStore = useDeviceStore();
const loading = ref(false);
const filter = ref('');
const subscriptions = ref<MissionSubscriptions>([])
const invites = ref<MissionInvite[]>([]);
const inviteUsername = ref('');
const inviteError = ref<Error | undefined>();
const userError = ref<Error | undefined>();
const showInvites = ref(false);
const editingUid = ref<string | null>(null);

const isOffline = computed(() => !deviceStore.network.isOnline);

const canInvite = computed(() => {
    if (!props.subscription.role) return false;
    return props.subscription.role.type === 'MISSION_OWNER'
        || props.subscription.role.permissions.includes('MISSION_WRITE');
});

const canManageRoles = computed(() => {
    if (!props.subscription.role) return false;
    return props.subscription.role.type === 'MISSION_OWNER'
        || props.subscription.role.permissions.includes('MISSION_SET_ROLE');
});

const excludeUids = computed(() => {
    const uids = subscriptions.value.map(sub => sub.clientUid);
    for (const invite of invites.value) {
        if (invite.type === 'clientUid' && invite.invitee) uids.push(invite.invitee);
    }
    return uids;
});

const excludeCallsigns = computed(() => {
    return invites.value
        .filter(invite => invite.type === 'callsign' && invite.invitee)
        .map(invite => invite.invitee as string);
});

const filteredSubscriptions = computed(() => {
    if (!filter.value) return subscriptions.value;
    return subscriptions.value.filter(sub => {
        return sub.username.toLowerCase().includes(filter.value.toLowerCase());
    });
});

onMounted(async () => {
    await fetchSubscriptions();
});

async function inviteUser(selection?: { callsign: string } | ContactType) {
    const invitee = (selection ? selection.callsign : inviteUsername.value).trim();
    if (!invitee) return;

    inviteError.value = undefined;

    const pending = excludeCallsigns.value.some(c => c.toLowerCase() === invitee.toLowerCase());
    if (pending) {
        inviteError.value = new Error(`${invitee} has already been invited`);
        return;
    }

    try {
        await props.subscription.invite(invitee);
        inviteUsername.value = '';
    } catch (err) {
        inviteError.value = err instanceof Error ? err : new Error(String(err));
    }

    await fetchSubscriptions();
}

function toggleEdit(clientUid: string) {
    editingUid.value = editingUid.value === clientUid ? null : clientUid;
}

async function removeUser(sub: MissionSubscriptions[number]) {
    userError.value = undefined;

    try {
        await props.subscription.removeUser(sub.clientUid);
        if (editingUid.value === sub.clientUid) editingUid.value = null;
    } catch (err) {
        userError.value = err instanceof Error ? err : new Error(String(err));
    }

    await fetchSubscriptions();
}

async function changeRole(sub: MissionSubscriptions[number], role: MissionRoleType) {
    if (role === sub.role.type) return;
    userError.value = undefined;

    try {
        await props.subscription.changeRole(sub, role);
    } catch (err) {
        userError.value = err instanceof Error ? err : new Error(String(err));
    }

    await fetchSubscriptions();
}

async function removeInvite(invite: MissionInvite) {
    if (!invite.invitee) return;
    await props.subscription.deleteInvite({
        type: invite.type || 'callsign',
        invitee: invite.invitee
    });
    await fetchSubscriptions();
}

async function fetchSubscriptions() {
    if (isOffline.value) return;
    loading.value = true;
    try {
        subscriptions.value = await props.subscription.subscriptions();
        if (canInvite.value) {
            invites.value = await props.subscription.invites();
        }
    } catch (err) {
        console.error(err);
    } finally {
        loading.value = false;
    }
}

function toContact(sub: MissionSubscriptions[number]): ContactType {
    return {
        uid: sub.clientUid,
        callsign: sub.username,
        role: sub.role.type,
        notes: sub.role.type,
        team: '',
        takv: '',
        filterGroups: null
    };
}
</script>

<template>
    <MenuTemplate
        name='Mission Subscribers'
        :back='false'
        :border='false'
        :loading='loading'
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
                        <UserClientSelect
                            v-model='inviteUsername'
                            :input='true'
                            placeholder='Username'
                            :groups='subscription.meta.groups'
                            @select='inviteUser($event)'
                        />
                        <button
                            class='btn btn-primary w-100 mt-2'
                            :disabled='!inviteUsername'
                            @click='inviteUser()'
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

        <div v-if='invites.length' class='col-12 px-2 py-2'>
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
                    <span class='badge rounded-pill small bg-danger text-white ms-auto'>{{ invites.length }}</span>
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
                        class='mt-2 pt-2 px-3 rounded-3 border border-white border-opacity-10 bg-black bg-opacity-25'
                        @click.stop
                    >
                        <div
                            v-for='invite in invites'
                            :key='invite.invitee'
                            class='d-flex align-items-center justify-content-between mb-2'
                        >
                            <div class='d-flex flex-column'>
                                <div v-text='invite.invitee' />
                                <div class='small text-muted' v-text='invite.role ? invite.role.name : "Unknown Role"' />
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
            v-else
            v-for='sub of filteredSubscriptions'
            :key='sub.clientUid'
            class='col-lg-12'
        >
            <Contact
                :contact='toContact(sub)'
                @chat='router.push(`/menu/chats/new?callsign=${$event.callsign}&uid=${$event.uid}`)'
            />
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { TablerNone, TablerInput, TablerDropdown, TablerIconButton, TablerDelete } from '@tak-ps/vue-tabler';
import { IconPlus, IconMail, IconChevronDown, IconChevronUp } from '@tabler/icons-vue';
import { std, stdurl } from '../../../../std.ts';
import type { MissionSubscriptions, Contact as ContactType, MissionInvite } from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import StandardItem from '../../util/StandardItem.vue';
import UserClientSelect from '../../util/UserClientSelect.vue';
import Contact from '../../util/Contact.vue';
import { useMapStore } from '../../../../stores/map.ts';

const props = defineProps<{
    subscription: Subscription
}>();

const mapStore = useMapStore();
const router = useRouter();
const loading = ref(false);
const filter = ref('');
const subscriptions = ref<MissionSubscriptions>([])
const invites = ref<MissionInvite[]>([]);
const inviteUsername = ref('');
const showInvites = ref(false);

const canInvite = computed(() => {
    if (!props.subscription.role) return false;
    return props.subscription.role.type === 'MISSION_OWNER'
        || props.subscription.role.permissions.includes('MISSION_WRITE');
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
    const invitee = selection ? selection.callsign : inviteUsername.value;
    if (!invitee) return;

    await props.subscription.invite(invitee);

    inviteUsername.value = '';
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
    loading.value = true;
    subscriptions.value = await props.subscription.subscriptions();
    if (canInvite.value) {
        invites.value = await props.subscription.invites();
    }
    loading.value = false;
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

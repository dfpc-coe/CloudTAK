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
                        <TablerInput
                            v-model='inviteUsername'
                            class='mt-2'
                            placeholder='Username'
                            @keyup.enter='inviteUser'
                        />
                        <button
                            class='btn btn-primary w-100 mt-2'
                            :disabled='!inviteUsername'
                            @click='inviteUser'
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
import { TablerNone, TablerInput, TablerDropdown, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconPlus } from '@tabler/icons-vue';
import { std, stdurl } from '../../../../std.ts';
import type { MissionSubscriptions, Contact as ContactType } from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import Contact from '../../util/Contact.vue';

const props = defineProps<{
    subscription: Subscription
}>();

const router = useRouter();
const loading = ref(false);
const filter = ref('');
const subscriptions = ref<MissionSubscriptions>([])
const inviteUsername = ref('');

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

async function inviteUser() {
    if (!inviteUsername.value) return;

    try {
        const url = stdurl(`/api/marti/missions/${props.subscription.guid}/invite`);
        url.searchParams.append('type', 'userName');
        url.searchParams.append('invitee', inviteUsername.value);

        await std(url, {
            method: 'POST'
        });

        inviteUsername.value = '';
    } catch (err) {
        console.error(err);
    }
}

async function fetchSubscriptions() {
    loading.value = true;
    subscriptions.value = await props.subscription.subscriptions();
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

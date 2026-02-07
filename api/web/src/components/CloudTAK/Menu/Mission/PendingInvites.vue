<template>
    <StandardItem
        v-if='invites.length'
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
                    :key='invite.token'
                    class='d-flex align-items-center justify-content-between mb-2'
                >
                    <span
                        class='text-break me-2'
                        v-text='invite.missionName'
                    />
                    <div class='d-flex align-items-center gap-1'>
                        <TablerIconButton
                            title='Delete Invite'
                            @click='deleteInvite(invite)'
                        >
                            <IconTrash
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <button
                            class='btn btn-success btn-sm'
                            @click='acceptInvite(invite)'
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>
        </transition>
    </StandardItem>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    IconMail,
    IconChevronDown,
    IconChevronUp,
    IconTrash
} from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import StandardItem from '../../util/StandardItem.vue';
import { std, stdurl } from '../../../../std.ts';
import type { MissionInvite } from '../../../../types.ts';

const props = defineProps<{
    invites: MissionInvite[]
}>();

const emit = defineEmits(['update:invites']);

const router = useRouter();
const showInvites = ref(false);

async function acceptInvite(invite: MissionInvite) {
    router.push({
        path: `/menu/missions/${invite.missionGuid}`,
        query: {
            token: invite.token,
            subscribe: 'true'
        }
    });
}

async function deleteInvite(invite: MissionInvite) {
    const url = stdurl(`/api/marti/missions/${invite.missionGuid}/invite`);
    url.searchParams.set('type', String(invite.type));
    url.searchParams.set('invitee', String(invite.invitee));

    await std(url, {
        method: 'DELETE'
    });

    const newInvites = props.invites.filter(i => i !== invite);
    emit('update:invites', newInvites);
}
</script>

<style scoped>
.menu-overlays-fade-enter-active,
.menu-overlays-fade-leave-active {
    transition: all 0.2s ease-out;
    max-height: 500px;
    opacity: 1;
    overflow: hidden;
}

.menu-overlays-fade-enter-from,
.menu-overlays-fade-leave-to {
    max-height: 0;
    opacity: 0;
    margin-top: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}
</style>

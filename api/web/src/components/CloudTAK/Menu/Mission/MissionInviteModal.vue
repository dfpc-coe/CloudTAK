<template>
    <TablerModal>
        <div class='modal-status bg-blue' />
        <div class='modal-body text-center py-4'>
            <IconMail
                :size='68'
                class='text-blue mb-2'
                stroke='1'
            />
            <h3>Mission Invitation</h3>
            <div class='text-secondary'>
                You have been invited to join the mission:
                <br>
                <strong class='text-white'>{{ props.mission.name }}</strong>
            </div>
        </div>
        <div class='modal-footer'>
            <div class='w-100'>
                <div class='row'>
                    <div class='col'>
                        <button
                            class='btn w-100'
                            @click='ignore'
                        >
                            Ignore
                        </button>
                    </div>
                    <div class='col'>
                        <button
                            class='btn btn-danger w-100'
                            @click='decline'
                        >
                            Delete
                        </button>
                    </div>
                    <div class='col'>
                        <button
                            class='btn btn-success w-100'
                            @click='accept'
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang="ts">
import type { paths } from '@cloudtak/api-types';
import { TablerModal } from '@tak-ps/vue-tabler';
import { IconMail } from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import { server } from '../../../../std.ts';
import Subscription from '../../../../base/subscription.ts';

const props = defineProps<{
    mission: {
        name: string;
        guid: string;
        token: string;
        authorUid: string;
        tool: string;
        type: string;
    }
}>();

const emit = defineEmits(['close']);
const router = useRouter();

type MissionInviteDeleteQuery = paths['/api/marti/missions/{:guid}/invite']['delete']['parameters']['query'];
const inviteTypes = new Set<MissionInviteDeleteQuery['type']>(['clientUid', 'callsign', 'userName', 'group', 'team']);

function ignore() {
    emit('close');
}

function accept() {
    emit('close');
    router.push({
        path: `/menu/missions/${props.mission.guid}`,
        query: {
            token: props.mission.token,
            subscribe: 'true'
        }
    });
}

async function decline() {
    try {
        // Fetch invites to find the invitee and type
        const res = await Subscription.list();
        const invite = res.invites.find(i => i.missionGuid === props.mission.guid);

        if (invite?.missionGuid && invite.type && invite.invitee && inviteTypes.has(invite.type as MissionInviteDeleteQuery['type'])) {
            const type = invite.type as MissionInviteDeleteQuery['type'];

            const { error } = await server.DELETE('/api/marti/missions/{:guid}/invite', {
                params: {
                    path: {
                        ':guid': invite.missionGuid,
                    },
                    query: {
                        type,
                        invitee: invite.invitee,
                    } satisfies MissionInviteDeleteQuery,
                }
            });

            if (error) throw new Error(error.message);
        }
    } catch (err) {
        console.error('Failed to decline invite', err);
    }
    emit('close');
}

</script>

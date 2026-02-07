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
import { TablerModal } from '@tak-ps/vue-tabler';
import { IconMail } from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../../../std.ts';
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

        if (invite) {
             const url = stdurl(`/api/marti/missions/${invite.missionGuid}/invite`);
            url.searchParams.set('type', String(invite.type));
            url.searchParams.set('invitee', String(invite.invitee));

            await std(url, {
                method: 'DELETE'
            });
        }
    } catch (err) {
        console.error('Failed to decline invite', err);
    }
    emit('close');
}

</script>

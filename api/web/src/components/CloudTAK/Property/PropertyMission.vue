<template>
    <div class='col-12 d-flex align-items-center gap-1'>
        <TablerButton
            class='w-100 d-flex align-items-center text-start'
            :title='name'
            @click='router.push(`/menu/missions/${props.guid}`)'
        >
            <IconAmbulance
                :size='20'
                stroke='1'
                class='flex-shrink-0'
            />
            <span class='mx-2 flex-shrink-0'>Associated Mission</span>
            <span
                class='text-muted text-truncate'
                v-text='name'
            />
        </TablerButton>

        <TablerIconButton
            v-if='props.edit'
            title='Remove Associated Mission'
            @click='emit("remove")'
        >
            <IconTrash
                :size='18'
                stroke='1'
            />
        </TablerIconButton>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { TablerButton, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconAmbulance, IconTrash } from '@tabler/icons-vue';
import Subscription from '../../../base/subscription.ts';

const props = defineProps<{
    /** GUID of the TAK Server Mission the CoT or Event is associated with */
    guid: string;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'remove'): void
}>();

const router = useRouter();

// The Mission is only named locally if the user is subscribed to it
const name = ref(props.guid);

onMounted(async () => {
    await loadName();
});

watch(() => props.guid, async () => {
    await loadName();
});

async function loadName(): Promise<void> {
    name.value = props.guid;

    const subscription = await Subscription.from(props.guid);
    if (subscription) name.value = subscription.meta.name;
}
</script>

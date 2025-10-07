<template>
    <div class='col-12 row'>
        <div class='d-flex align-items-center'>
            <div>
                <IconUser
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
                <label class='subheader user-select-none'>Author</label>
            </div>
            <div class='ms-auto'>
                <span
                    v-if='props.creator.time'
                    class='cursor-pointer'
                    @click='relative = !relative'
                    v-text='relative ? timediff(props.creator.time) : props.creator.time'
                />
            </div>
        </div>
        <div class='mx-2'>
            <ContactRow
                :contact='contact || props.creator'
                @chat='router.push(`/menu/chats/new?callsign=${$event.callsign}&uid=${$event.uid}`)'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import timediff from '../../../timediff.ts';
import ContactRow from './Contact.vue';
import { useMapStore } from '../../../stores/map.ts';
import type { Contact, FeaturePropertyCreator } from '../../../types.ts';
import { useRouter } from 'vue-router';
const mapStore = useMapStore();
import {
    IconUser
} from '@tabler/icons-vue';

const props = defineProps<{
    creator: FeaturePropertyCreator
}>();

const router = useRouter();
const relative = ref(true);
const contact = ref<Contact | undefined>();

onMounted(async () => {
    contact.value = await mapStore.worker.team.get(props.creator.uid);
});
</script>

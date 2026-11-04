<template>
    <PropertyFactRow
        label='Creator'
        class='py-1'
    >
        <div
            class='d-flex align-items-center gap-2'
            style='min-width: 0;'
        >
            <span
                class='text-truncate'
                :title='props.creator.uid'
                v-text='effectiveContact.callsign || props.creator.uid'
            />
            <span
                v-if='props.creator.time'
                class='text-secondary small flex-shrink-0 cursor-pointer user-select-none'
                title='Toggle relative & absolute time'
                @click='relative = !relative'
                v-text='relative ? timediff(props.creator.time) : new Date(props.creator.time).toLocaleString()'
            />
        </div>

        <template
            v-if='contact'
            #actions
        >
            <TablerIconButton
                title='Chat'
                @click='router.push(`/menu/chats/new?callsign=${effectiveContact.callsign}&uid=${effectiveContact.uid}`)'
            >
                <IconMessage
                    :size='20'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
    </PropertyFactRow>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import timediff from '../../../timediff.ts';
import ContactManager from '../../../base/contact.ts';
import type { Contact, FeaturePropertyCreator } from '../../../types.ts';
import { useRouter } from 'vue-router';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconMessage } from '@tabler/icons-vue';
import PropertyFactRow from '../util/PropertyFactRow.vue';

const props = defineProps<{
    creator: FeaturePropertyCreator
}>();

const router = useRouter();
const relative = ref(true);
const contact = ref<Contact | undefined>();

const effectiveContact = computed((): Contact => {
    return contact.value ?? {
        uid: props.creator.uid,
        callsign: props.creator.callsign ?? '',
        notes: '',
        team: '',
        role: '',
        takv: '',
        filterGroups: undefined,
    };
});

onMounted(async () => {
    contact.value = await ContactManager.from(props.creator.uid);
});
</script>

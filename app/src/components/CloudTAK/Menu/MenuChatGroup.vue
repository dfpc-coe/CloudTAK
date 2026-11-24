<template>
    <TablerModal>
        <div class='modal-status bg-white' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-body'>
            <div class='modal-title'>
                {{ room ? 'Edit Group' : 'New Group' }}
            </div>
        </div>
        <div class='modal-body text-body'>
            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerInput
                v-model='name'
                label='Group Name'
                :disabled='saving'
            />
            <div class='mt-3'>
                <label class='form-label'>Members ({{ selected.size }})</label>
                <TablerInput
                    v-model='filter'
                    icon='search'
                    placeholder='Filter Contacts'
                />
                <div
                    class='overflow-y-auto border rounded mt-2'
                    style='max-height: 40vh;'
                >
                    <TablerNone
                        v-if='!filtered.length'
                        label='No Contacts'
                        :create='false'
                        :compact='true'
                    />
                    <label
                        v-for='contact in filtered'
                        :key='contact.uid'
                        class='d-flex align-items-center gap-2 px-2 py-1 cursor-pointer'
                    >
                        <input
                            type='checkbox'
                            class='form-check-input mt-0'
                            :checked='selected.has(contact.uid)'
                            @change='toggle(contact)'
                        >
                        <span
                            class='text-truncate'
                            v-text='contact.callsign'
                        />
                    </label>
                </div>
            </div>
        </div>
        <div class='modal-footer'>
            <button
                class='btn btn-primary'
                :disabled='saving || !name.trim().length || !selected.size'
                @click='save'
            >
                {{ room ? 'Save' : 'Create' }}
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import {
    TablerAlert,
    TablerInput,
    TablerModal,
    TablerNone,
} from '@tak-ps/vue-tabler';
import Chatroom from '../../../base/chatroom.ts';
import type { ChatroomContact } from '../../../base/chatroom.ts';
import ContactManager from '../../../base/contact.ts';
import type { DBChatroom } from '../../../database.ts';

const props = defineProps<{
    /** Edit the name & Members of this Group instead of creating one */
    room?: DBChatroom;
    myUID: string;
}>();

const emit = defineEmits<{
    close: [];
    saved: [id: string];
}>();

const name = ref(props.room?.name ?? '');
const filter = ref('');
const saving = ref(false);
const error = ref<Error | undefined>(undefined);

const contacts = ref<Array<ChatroomContact>>([]);
const selected = ref<Map<string, ChatroomContact>>(new Map());

const filtered = computed(() => {
    const term = filter.value.toLowerCase();

    return contacts.value
        .filter((contact) => contact.callsign.toLowerCase().includes(term))
        .sort((a, b) => a.callsign.localeCompare(b.callsign));
});

onMounted(async () => {
    const known = new Map<string, ChatroomContact>();

    for (const member of props.room?.members ?? []) {
        if (member.uid === props.myUID) continue;

        known.set(member.uid, { uid: member.uid, callsign: member.callsign });
        selected.value.set(member.uid, { uid: member.uid, callsign: member.callsign });
    }

    try {
        for (const contact of await ContactManager.list()) {
            if (contact.uid === props.myUID) continue;
            known.set(contact.uid, { uid: contact.uid, callsign: contact.callsign });
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    contacts.value = [...known.values()];
});

function toggle(contact: ChatroomContact): void {
    if (selected.value.has(contact.uid)) {
        selected.value.delete(contact.uid);
    } else {
        selected.value.set(contact.uid, contact);
    }
}

async function save(): Promise<void> {
    saving.value = true;
    error.value = undefined;

    try {
        const members = [...selected.value.values()];

        if (props.room) {
            const room = new Chatroom(props.room);

            if (name.value.trim() !== props.room.name) await room.update({ name: name.value.trim() });
            await room.members(members);

            emit('saved', room.id);
        } else {
            const room = await Chatroom.group(name.value.trim(), members);
            emit('saved', room.id);
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    saving.value = false;
}
</script>

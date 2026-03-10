<template>
    <TablerLoading v-if='loading' />
    <TablerAlert
        v-else-if='error'
        :err='error'
    />
    <div
        v-else
        class='d-flex flex-column h-100 overflow-hidden'
    >
        <div
            v-if='canDelete && multiselect && chats.length'
            class='d-flex align-items-center border-bottom px-2 py-1 gap-2'
        >
            <TablerDelete
                :disabled='selected.size === 0'
                displaytype='icon'
                @delete='emitDelete'
            />
            <span class='small text-muted'>{{ selected.size }} selected</span>
            <button
                class='btn btn-sm btn-link ms-auto p-0'
                @click='selected.clear()'
            >
                Clear
            </button>
        </div>

        <div
            ref='scrollContainer'
            class='flex-grow-1 position-relative'
            style='min-height: 0; overflow-y: auto;'
            @scroll='onScroll'
        >
            <TablerNone
                v-if='!chats.length'
                :create='false'
                label='No Chat Messages'
            />
            <div
                v-for='chat in chats'
                :key='chat.id'
                class='w-100 d-flex my-2 px-2'
                :class='{ "cursor-pointer": canDelete && multiselect }'
                @click='canDelete && multiselect ? toggleSelect(chat.id) : undefined'
            >
                <div
                    v-if='canDelete && multiselect'
                    class='d-flex align-items-center me-2'
                >
                    <input
                        type='checkbox'
                        :checked='selected.has(chat.id)'
                        class='form-check-input mt-0'
                        @click.stop='toggleSelect(chat.id)'
                    >
                </div>

                <div
                    v-if='chat.sender_uid !== myUID'
                    class='bg-blue px-2 py-2 rounded'
                    style='max-width: 80%;'
                >
                    <div class='fw-bold small mb-1'>
                        <span v-text='chat.sender || "Unknown"' />
                    </div>
                    <div v-text='chat.message' />
                    <div
                        class='text-end'
                        style='font-size: 0.75rem; opacity: 0.75;'
                        v-text='formatTime(chat.created)'
                    />
                </div>
                <div
                    v-else
                    class='ms-auto bg-accent px-2 py-2 rounded'
                    style='max-width: 80%;'
                >
                    <div v-text='chat.message' />
                    <div
                        class='text-end'
                        style='font-size: 0.75rem; opacity: 0.75;'
                        v-text='formatTime(chat.created)'
                    />
                </div>
            </div>
        </div>

        <div
            v-if='canSend'
            class='flex-shrink-0 border-top position-relative pt-1'
        >
            <button
                v-if='chats.length && !atBottom'
                class='btn btn-primary rounded-circle position-absolute start-50 p-1 scroll-bottom-btn'
                style='z-index: 10; top: -56px; width: 44px; height: 44px;'
                title='Scroll to bottom'
                @click='scrollToBottom'
            >
                <IconArrowDown
                    :size='24'
                    stroke='2.5'
                />
            </button>
            <div class='d-flex align-items-center mx-2 mb-2 mt-1'>
                <div class='flex-grow-1 me-2'>
                    <TablerInput
                        v-model='message'
                        @keyup.enter='sendMessage'
                    />
                </div>
                <TablerIconButton
                    title='Send Message'
                    @click='sendMessage'
                >
                    <IconSend
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, nextTick } from 'vue';
import {
    IconSend,
    IconArrowDown,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerInput,
    TablerLoading,
    TablerNone,
} from '@tak-ps/vue-tabler';
import timeDiff from '../../../timediff.ts';

export type ChatMessage = {
    id: string;
    sender_uid: string;
    sender?: string;
    message: string;
    created: string;
};

const props = withDefaults(defineProps<{
    chats: ChatMessage[];
    myUID: string;
    loading?: boolean;
    error?: Error;
    canSend?: boolean;
    canDelete?: boolean;
    multiselect?: boolean;
}>(), {
    loading: false,
    error: undefined,
    canSend: false,
    canDelete: false,
    multiselect: false,
});

const emit = defineEmits<{
    send: [message: string];
    delete: [ids: string[]];
}>();

const scrollContainer = ref<HTMLElement | null>(null);
const atBottom = ref(true);
const message = ref('');
const selected = ref<Set<string>>(new Set());

watch(() => props.chats, async (newChats) => {
    if (atBottom.value && newChats.length) {
        await nextTick();
        scrollToBottom();
    }
}, { deep: false });

function onScroll() {
    const el = scrollContainer.value;
    if (!el) return;
    atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
}

function scrollToBottom() {
    const el = scrollContainer.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottom.value = true;
}

function toggleSelect(id: string) {
    if (selected.value.has(id)) {
        selected.value.delete(id);
    } else {
        selected.value.add(id);
    }
}

function sendMessage() {
    if (!message.value.trim().length) return;
    emit('send', message.value);
    message.value = '';
}

function emitDelete() {
    emit('delete', Array.from(selected.value));
    selected.value = new Set();
}

function formatTime(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 86400000 && diff >= 0) {
        return timeDiff(iso);
    }

    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');

    return `${month} ${day}, ${hour}:${minute}`;
}

defineExpose({ scrollToBottom });
</script>

<style scoped>
@keyframes float {
    0% {
        transform: translateX(-50%) translateY(0);
    }
    50% {
        transform: translateX(-50%) translateY(-6px);
    }
    100% {
        transform: translateX(-50%) translateY(0);
    }
}

.scroll-bottom-btn {
    opacity: 0.9;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
    animation: float 2.5s ease-in-out infinite;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s ease, background-color 0.2s ease;
}

.scroll-bottom-btn:hover {
    opacity: 1;
    background-color: var(--bs-primary-dark, #0b5ed7);
    animation: none;
    transform: translateX(-50%) translateY(0);
}
</style>

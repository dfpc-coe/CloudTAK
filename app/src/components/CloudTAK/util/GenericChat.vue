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
            class='flex-grow-1 position-relative pt-4'
            style='min-height: 0; overflow-y: auto;'
            @scroll='onScroll'
        >
            <TablerNone
                v-if='!chats.length'
                :create='false'
                label='No Chat Messages'
            />
            <div
                v-else-if='more'
                class='d-flex justify-content-center py-2'
            >
                <button
                    class='btn btn-sm btn-link'
                    @click='emit("older")'
                >
                    Load older messages
                </button>
            </div>
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
                    class='chat-bubble position-relative bg-blue text-white px-2 py-2 rounded'
                    :class='{ "chat-bubble-rich": hasActions(chat), "chat-bubble-active": active === chat.id }'
                    style='max-width: 80%;'
                    @click='onBubbleClick(chat)'
                    @mouseleave='onBubbleLeave(chat)'
                >
                    <ChatMessageToolbar
                        v-if='hasActions(chat)'
                        :own='false'
                        :picking='reacting === chat.id'
                        :emojis='ReactionEmoji'
                        @pick='reacting = reacting === chat.id ? undefined : chat.id'
                        @react='toggleReaction(chat, $event)'
                        @reply='startReply(chat)'
                        @edit='startEdit(chat)'
                        @remove='removeChat(chat)'
                    />
                    <div class='fw-bold small mb-1'>
                        <span v-text='chat.sender || "Unknown"' />
                    </div>
                    <div
                        v-if='quoteOf(chat)'
                        class='chat-quote small mb-1 ps-2'
                    >
                        <div
                            class='fw-bold'
                            v-text='quoteOf(chat)?.sender || "Unknown"'
                        />
                        <div
                            class='text-truncate'
                            v-text='quoteOf(chat)?.deleted ? "Message deleted" : quoteOf(chat)?.message'
                        />
                    </div>
                    <div
                        v-if='chat.deleted'
                        class='fst-italic'
                        style='opacity: 0.75;'
                    >
                        Message deleted
                    </div>
                    <div
                        v-else-if='editing === chat.id'
                        class='d-flex flex-column gap-1'
                    >
                        <textarea
                            v-model='editText'
                            class='form-control form-control-sm'
                            rows='2'
                            @keydown.enter.exact.prevent='saveEdit(chat.id)'
                            @keydown.esc='editing = undefined'
                        />
                        <div class='d-flex justify-content-end gap-2'>
                            <button
                                class='btn btn-sm btn-link p-0'
                                @click.stop='editing = undefined'
                            >
                                Cancel
                            </button>
                            <button
                                class='btn btn-sm btn-link p-0'
                                @click.stop='saveEdit(chat.id)'
                            >
                                Save
                            </button>
                        </div>
                    </div>
                    <div
                        v-else
                        class='chat-message'
                        v-text='chat.message'
                    />
                    <div
                        v-if='chat.reactions?.length'
                        class='d-flex flex-wrap gap-1 mt-1'
                    >
                        <button
                            v-for='reaction in chat.reactions'
                            :key='reaction.emoji'
                            type='button'
                            class='chat-reaction'
                            :class='{ "chat-reaction-mine": reaction.uids.includes(myUID) }'
                            :title='`${reaction.uids.length} reacted`'
                            @click.stop='toggleReaction(chat, reaction.emoji)'
                        >
                            <span v-text='reaction.emoji' />
                            <span
                                class='chat-reaction-count'
                                v-text='reaction.uids.length'
                            />
                        </button>
                    </div>
                    <div
                        class='text-end'
                        style='font-size: 0.75rem; opacity: 0.75;'
                    >
                        <span
                            v-if='chat.edited && !chat.deleted'
                            class='me-1'
                        >edited</span>
                        <span v-text='formatTime(chat.created)' />
                    </div>
                </div>
                <div
                    v-else
                    class='chat-bubble position-relative ms-auto cloudtak-accent px-2 py-2 rounded'
                    :class='{ "chat-bubble-rich": hasActions(chat), "chat-bubble-active": active === chat.id }'
                    style='max-width: 80%;'
                    @click='onBubbleClick(chat)'
                    @mouseleave='onBubbleLeave(chat)'
                >
                    <ChatMessageToolbar
                        v-if='hasActions(chat)'
                        :own='true'
                        :picking='reacting === chat.id'
                        :emojis='ReactionEmoji'
                        @pick='reacting = reacting === chat.id ? undefined : chat.id'
                        @react='toggleReaction(chat, $event)'
                        @reply='startReply(chat)'
                        @edit='startEdit(chat)'
                        @remove='removeChat(chat)'
                    />
                    <div
                        v-if='quoteOf(chat)'
                        class='chat-quote small mb-1 ps-2'
                    >
                        <div
                            class='fw-bold'
                            v-text='quoteOf(chat)?.sender || "Unknown"'
                        />
                        <div
                            class='text-truncate'
                            v-text='quoteOf(chat)?.deleted ? "Message deleted" : quoteOf(chat)?.message'
                        />
                    </div>
                    <div
                        v-if='chat.deleted'
                        class='fst-italic'
                        style='opacity: 0.75;'
                    >
                        Message deleted
                    </div>
                    <div
                        v-else-if='editing === chat.id'
                        class='d-flex flex-column gap-1'
                    >
                        <textarea
                            v-model='editText'
                            class='form-control form-control-sm'
                            rows='2'
                            @keydown.enter.exact.prevent='saveEdit(chat.id)'
                            @keydown.esc='editing = undefined'
                        />
                        <div class='d-flex justify-content-end gap-2'>
                            <button
                                class='btn btn-sm btn-link p-0'
                                @click.stop='editing = undefined'
                            >
                                Cancel
                            </button>
                            <button
                                class='btn btn-sm btn-link p-0'
                                @click.stop='saveEdit(chat.id)'
                            >
                                Save
                            </button>
                        </div>
                    </div>
                    <div
                        v-else
                        class='chat-message'
                        v-text='chat.message'
                    />
                    <div
                        v-if='chat.reactions?.length'
                        class='d-flex flex-wrap gap-1 mt-1'
                    >
                        <button
                            v-for='reaction in chat.reactions'
                            :key='reaction.emoji'
                            type='button'
                            class='chat-reaction'
                            :class='{ "chat-reaction-mine": reaction.uids.includes(myUID) }'
                            :title='`${reaction.uids.length} reacted`'
                            @click.stop='toggleReaction(chat, reaction.emoji)'
                        >
                            <span v-text='reaction.emoji' />
                            <span
                                class='chat-reaction-count'
                                v-text='reaction.uids.length'
                            />
                        </button>
                    </div>
                    <div
                        class='d-flex align-items-center justify-content-end'
                        style='font-size: 0.75rem; opacity: 0.75;'
                    >
                        <span
                            v-if='chat.edited && !chat.deleted'
                            class='me-1'
                        >edited</span>
                        <span v-text='formatTime(chat.created)' />
                        <span
                            v-if='chat.status'
                            :title='statusLabel(chat.status)'
                            class='ms-1 d-flex align-items-center'
                            :aria-label='statusLabel(chat.status)'
                        >
                            <IconClock
                                v-if='chat.status === ChatStatus.Sending || chat.status === ChatStatus.Pending'
                                :size='14'
                                stroke='2'
                            />
                            <IconAlertTriangle
                                v-else-if='chat.status === ChatStatus.Failed'
                                :size='14'
                                stroke='2'
                                class='text-red'
                            />
                            <IconCheck
                                v-else-if='chat.status === ChatStatus.Sent'
                                :size='14'
                                stroke='2'
                            />
                            <IconChecks
                                v-else-if='chat.status === ChatStatus.Delivered'
                                :size='14'
                                stroke='2'
                            />
                            <IconChecks
                                v-else-if='chat.status === ChatStatus.Read'
                                :size='14'
                                stroke='2'
                                class='text-azure'
                            />
                        </span>
                        <button
                            v-if='chat.status === ChatStatus.Failed'
                            class='btn btn-sm btn-link p-0 ms-2'
                            style='font-size: 0.75rem;'
                            @click.stop='emit("retry", chat.id)'
                        >
                            Retry
                        </button>
                    </div>
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
            <div
                v-if='replyTo'
                class='d-flex align-items-center mx-2 mt-1 px-2 py-1 rounded chat-quote small'
            >
                <div
                    class='flex-grow-1'
                    style='min-width: 0;'
                >
                    <div class='fw-bold'>
                        Replying to {{ replyTo.sender || "Unknown" }}
                    </div>
                    <div
                        class='text-truncate'
                        v-text='replyTo.message'
                    />
                </div>
                <TablerIconButton
                    title='Cancel Reply'
                    @click='replyTo = undefined'
                >
                    <IconX
                        :size='16'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
            <MessageComposer
                ref='composer'
                class='mx-2 mb-2 mt-1'
                submit-label='Send'
                :placeholder='placeholder'
                :collapse-on-send='false'
                :toolbar='false'
                @send='sendMessage'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, nextTick } from 'vue';
import {
    IconArrowDown,
    IconClock,
    IconCheck,
    IconChecks,
    IconAlertTriangle,
    IconX,
} from '@tabler/icons-vue';
import { ChatStatus } from '../../../database.ts';
import {
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerLoading,
    TablerNone,
} from '@tak-ps/vue-tabler';
import timeDiff from '../../../timediff.ts';
import MessageComposer from './MessageComposer.vue';
import ChatMessageToolbar from './ChatMessageToolbar.vue';

export type ChatMessage = {
    id: string | number;
    sender_uid: string;
    sender?: string;
    message: string;
    created: string;
    status?: ChatStatus;
    reply_to?: string | null;
    edited?: string | null;
    deleted?: string | null;
    reactions?: Array<{ emoji: string; uids: Array<string> }>;
};

const ReactionEmoji = ['👍', '👎', '✅', '❓', '❤️'];

const props = withDefaults(defineProps<{
    chats: ChatMessage[];
    myUID: string;
    loading?: boolean;
    error?: Error;
    canSend?: boolean;
    canDelete?: boolean;
    multiselect?: boolean;
    placeholder?: string;
    /** Offer replies, reactions, and edit & delete of the user's own messages */
    rich?: boolean;
    /** Older messages can be requested with the `older` event */
    more?: boolean;
}>(), {
    rich: false,
    more: false,
    loading: false,
    error: undefined,
    canSend: false,
    canDelete: false,
    multiselect: false,
    placeholder: 'Send Message...',
});

const emit = defineEmits<{
    send: [message: string, opts: { reply_to?: string }];
    delete: [ids: Array<string | number>];
    retry: [id: string | number];
    older: [];
    edit: [id: string | number, message: string];
    remove: [id: string | number];
    react: [id: string | number, emoji: string, active: boolean];
    'at-bottom': [atBottom: boolean];
}>();

const scrollContainer = ref<HTMLElement | null>(null);
const atBottom = ref(true);
const composer = ref<InstanceType<typeof MessageComposer>>();
const selected = ref<Set<string | number>>(new Set());

const replyTo = ref<ChatMessage | undefined>(undefined);
const editing = ref<string | number | undefined>(undefined);
const editText = ref('');
const reacting = ref<string | number | undefined>(undefined);

function isLocal(chat: ChatMessage): boolean {
    return chat.status === ChatStatus.Sending || chat.status === ChatStatus.Failed;
}

function quoteOf(chat: ChatMessage): ChatMessage | undefined {
    if (!chat.reply_to) return undefined;
    return props.chats.find((c) => c.id === chat.reply_to);
}

// The message whose toolbar a tap opened - hover shows it without this on a pointer device
const active = ref<string | number | undefined>(undefined);

function hasActions(chat: ChatMessage): boolean {
    return props.rich && !props.multiselect && !chat.deleted && !isLocal(chat) && editing.value !== chat.id;
}

function onBubbleClick(chat: ChatMessage): void {
    if (!hasActions(chat)) return;

    active.value = active.value === chat.id ? undefined : chat.id;
    if (active.value !== chat.id && reacting.value === chat.id) reacting.value = undefined;
}

function onBubbleLeave(chat: ChatMessage): void {
    if (reacting.value === chat.id) reacting.value = undefined;
    if (active.value === chat.id) active.value = undefined;
}

function startReply(chat: ChatMessage): void {
    active.value = undefined;
    replyTo.value = chat;
    composer.value?.focus();
}

function startEdit(chat: ChatMessage): void {
    active.value = undefined;
    editing.value = chat.id;
    editText.value = chat.message;
}

function removeChat(chat: ChatMessage): void {
    active.value = undefined;
    emit('remove', chat.id);
}

function saveEdit(id: string | number): void {
    const text = editText.value.trim();
    editing.value = undefined;
    if (text.length) emit('edit', id, text);
}

function toggleReaction(chat: ChatMessage, emoji: string): void {
    const mine = chat.reactions?.find((reaction) => reaction.emoji === emoji)?.uids.includes(props.myUID) ?? false;
    reacting.value = undefined;
    active.value = undefined;
    emit('react', chat.id, emoji, !mine);
}

watch(atBottom, (value) => {
    emit('at-bottom', value);
}, { immediate: true });

watch(() => props.chats, async (newChats) => {
    if (atBottom.value && newChats.length) {
        await nextTick();
        scrollToBottom();
    }
}, { deep: false });

onMounted(async () => {
    await nextTick();
    scrollToBottom();
});

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

function toggleSelect(id: string | number) {
    if (selected.value.has(id)) {
        selected.value.delete(id);
    } else {
        selected.value.add(id);
    }
}

function sendMessage(text: string) {
    if (!text.trim().length) return;
    emit('send', text, replyTo.value ? { reply_to: String(replyTo.value.id) } : {});
    replyTo.value = undefined;
    void composer.value?.reset();
}

function emitDelete() {
    emit('delete', Array.from(selected.value));
    selected.value = new Set();
}

function statusLabel(status: ChatStatus): string {
    switch (status) {
        case ChatStatus.Sending: return 'Sending';
        case ChatStatus.Sent: return 'Sent to Server';
        case ChatStatus.Pending: return 'Pending Delivery';
        case ChatStatus.Failed: return 'Failed to Deliver';
        case ChatStatus.Delivered: return 'Delivered';
        case ChatStatus.Read: return 'Read';
        default: return '';
    }
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
.chat-message {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.chat-quote {
    padding-top: 2px;
    padding-bottom: 2px;
    border-left: 3px solid currentColor;
    border-radius: 0 6px 6px 0;
    background: rgba(127, 127, 127, 0.2);
    opacity: 0.9;
}

.chat-bubble :deep(.chat-toolbar) {
    display: none !important;
}

.chat-bubble-rich:hover :deep(.chat-toolbar),
.chat-bubble-active :deep(.chat-toolbar) {
    display: flex !important;
}

.chat-reaction {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border: 1px solid transparent;
    border-radius: 999px;
    color: inherit;
    font-size: 0.8rem;
    line-height: 1.4;
    background: rgba(127, 127, 127, 0.22);
    transition: background-color 0.12s ease;
}

.chat-reaction:hover {
    background: rgba(127, 127, 127, 0.34);
}

.chat-reaction-count {
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.85;
}

.chat-reaction-mine {
    border-color: currentColor;
    background: rgba(127, 127, 127, 0.34);
}

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

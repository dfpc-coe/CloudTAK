<template>
    <div
        class='chat-toolbar position-absolute d-flex align-items-center'
        :class='own ? "chat-toolbar-own" : "chat-toolbar-other"'
        role='toolbar'
        aria-label='Message actions'
        @click.stop
    >
        <template v-if='picking'>
            <button
                v-for='emoji in emojis'
                :key='emoji'
                type='button'
                class='chat-toolbar-btn chat-toolbar-emoji'
                :title='`React with ${emoji}`'
                @click.stop='emit("react", emoji)'
                v-text='emoji'
            />
            <div class='chat-toolbar-divider' />
        </template>
        <button
            type='button'
            class='chat-toolbar-btn'
            :class='{ "chat-toolbar-btn-on": picking }'
            title='Add Reaction'
            @click.stop='emit("pick")'
        >
            <IconMoodPlus
                :size='18'
                stroke='1.5'
            />
        </button>
        <button
            type='button'
            class='chat-toolbar-btn'
            title='Reply'
            @click.stop='emit("reply")'
        >
            <IconArrowBackUp
                :size='18'
                stroke='1.5'
            />
        </button>
        <template v-if='own'>
            <button
                type='button'
                class='chat-toolbar-btn'
                title='Edit'
                @click.stop='emit("edit")'
            >
                <IconPencil
                    :size='18'
                    stroke='1.5'
                />
            </button>
            <button
                type='button'
                class='chat-toolbar-btn chat-toolbar-btn-danger'
                title='Delete'
                @click.stop='emit("remove")'
            >
                <IconTrash
                    :size='18'
                    stroke='1.5'
                />
            </button>
        </template>
    </div>
</template>

<script setup lang='ts'>
import {
    IconArrowBackUp,
    IconMoodPlus,
    IconPencil,
    IconTrash,
} from '@tabler/icons-vue';

defineProps<{
    /** The message was sent by the user, who can also edit & delete it */
    own: boolean;
    /** The emoji choices are shown */
    picking: boolean;
    emojis: Array<string>;
}>();

const emit = defineEmits<{
    pick: [];
    react: [emoji: string];
    reply: [];
    edit: [];
    remove: [];
}>();
</script>

<style scoped>
.chat-toolbar {
    top: -30px;
    z-index: 5;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    white-space: nowrap;
    color: var(--cloudtak-surface-color, var(--tblr-body-color));
    background: var(--tblr-bg-surface);
    border: 1px solid var(--cloudtak-surface-border, var(--tblr-border-color));
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
}

/* Anchored to the side of the pane the bubble is on and grows towards the middle,
 * so a short bubble never pushes it past the edge */
.chat-toolbar-other {
    left: 8px;
}

.chat-toolbar-own {
    right: 8px;
}

.chat-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    color: inherit;
    background: transparent;
    opacity: 0.8;
    transition: background-color 0.12s ease, opacity 0.12s ease;
}

.chat-toolbar-btn:hover,
.chat-toolbar-btn:focus-visible,
.chat-toolbar-btn-on {
    opacity: 1;
    background: var(--cloudtak-hover-bg, rgba(127, 127, 127, 0.18));
    outline: none;
}

.chat-toolbar-btn-danger:hover,
.chat-toolbar-btn-danger:focus-visible {
    color: var(--tblr-red);
}

.chat-toolbar-emoji {
    font-size: 1.05rem;
    line-height: 1;
    opacity: 1;
}

.chat-toolbar-emoji:hover {
    transform: scale(1.15);
}

.chat-toolbar-divider {
    width: 1px;
    height: 18px;
    margin: 0 2px;
    background: var(--cloudtak-surface-border, var(--tblr-border-color));
}
</style>

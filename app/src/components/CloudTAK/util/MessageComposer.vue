<template>
    <div class='d-flex align-items-start gap-2'>
        <div
            v-if='avatar'
            class='composer-avatar d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle fw-bold'
            :title='avatarTitle || avatar'
            v-text='avatar'
        />

        <div
            class='flex-grow-1'
            style='min-width: 0;'
        >
            <input
                v-if='!open'
                type='text'
                class='form-control'
                :placeholder='placeholder'
                :aria-label='placeholder'
                :disabled='busy'
                @focus='open = true'
            >
            <template v-else>
                <div @keydown.esc.prevent='cancel'>
                    <TablerMarkdownEditor
                        ref='editor'
                        :model-value='draft'
                        :label='placeholder'
                        :toolbar='toolbar'
                        :autofocus='true'
                        :disabled='busy'
                        @update:model-value='draft = $event'
                        @submit='keyboardSubmit'
                    />
                </div>
                <slot />
                <div class='d-flex align-items-center gap-2 mt-2'>
                    <span
                        v-if='!appStore.isMobileDetected'
                        class='small text-secondary'
                        v-text='hintText'
                    />
                    <span class='flex-grow-1' />
                    <button
                        type='button'
                        class='btn btn-sm'
                        :disabled='busy'
                        @click='cancel'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        class='btn btn-sm btn-primary'
                        :disabled='busy || !draft.trim()'
                        @click='submit'
                        v-text='submitLabel'
                    />
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
/**
 * MessageComposer - a single-line input that grows into a Markdown editor
 * with submit & cancel on focus. The caller performs the send and calls
 * reset() once it succeeds, so a failed send keeps the text in place. The
 * default slot renders extra fields between the editor and the buttons
 */
import { ref, computed, watch, nextTick } from 'vue';
import { TablerMarkdownEditor } from '@tak-ps/vue-tabler';
import { useAppStore } from '../../../stores/app.ts';

const props = withDefaults(defineProps<{
    placeholder?: string;
    /** Initials or short label drawn beside the input */
    avatar?: string;
    avatarTitle?: string;
    submitLabel?: string;
    /** Text under the editor - defaults to the keyboard shortcut */
    hint?: string;
    /** Return to the single-line input after a send from the button - a keyboard send always stays open for the next entry */
    collapseOnSend?: boolean;
    /** Show the Markdown formatting toolbar */
    toolbar?: boolean;
    busy?: boolean;
}>(), {
    placeholder: 'Write a message…',
    avatar: undefined,
    avatarTitle: undefined,
    submitLabel: 'Post',
    hint: undefined,
    collapseOnSend: true,
    toolbar: true,
    busy: false,
});

const emit = defineEmits<{
    (e: 'send', text: string): void;
}>();

const appStore = useAppStore();

const open = ref(false);
const draft = ref('');
const editor = ref<{ focus: () => void }>();

/** Focus requested while the editor was disabled by busy - granted once it is enabled again */
let pendingFocus = false;

watch(() => props.busy, async (busy) => {
    if (busy) return;
    await nextTick();
    focusEditor();
});

function focusEditor(): void {
    if (!pendingFocus || props.busy) return;
    pendingFocus = false;
    editor.value?.focus();
}

const hintText = computed(() => props.hint ?? `Ctrl+Enter to ${props.submitLabel}`);

/** The editor emits submit on Ctrl/Cmd+Enter */
function keyboardSubmit(): void {
    viaKeyboard = true;
    submit();
}

/** Set by the keyboard shortcut right before a submit so reset() knows to keep the editor open */
let viaKeyboard = false;

function submit(): void {
    const text = draft.value.trim();
    if (!text || props.busy) return;
    emit('send', text);
}

function cancel(): void {
    draft.value = '';
    open.value = false;
}

/** Clear the text after a successful send */
async function reset(): Promise<void> {
    draft.value = '';

    const stayOpen = viaKeyboard || !props.collapseOnSend;
    viaKeyboard = false;

    if (!stayOpen) {
        open.value = false;
        return;
    }

    pendingFocus = true;
    await nextTick();
    focusEditor();
}

defineExpose({ reset, focus: () => editor.value?.focus() });
</script>

<style scoped>
.composer-avatar {
    width: 28px;
    height: 28px;
    margin-top: 4px;
    font-size: 11px;
    background: rgba(59, 130, 246, 0.2);
    color: var(--tblr-primary);
}
</style>

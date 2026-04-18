<template>
    <div>
        <div
            ref='tagEntryEl'
            :class='{
                "tag-entry--focus": isInputActive,
                "is-invalid": error
            }'
            class='form-control tag-entry my-2 py-1 px-1'
            @click='focusNewTag()'
        >
            <div class='tag-entry-content'>
                <TablerBadge
                    v-for='(tag, index) in innerTags'
                    :key='index'
                    class='mx-1 my-1 d-flex'
                    style='height: 24px;'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    <slot
                        v-if='$slots.item'
                        name='item'
                        v-bind='{ name: tag, index }'
                    />
                    <span v-else> {{ tag }} </span>

                    <TablerIconButton
                        v-if='!disabled'
                        title='Remove Tag'
                        @click.prevent.stop='removeTag(index)'
                    >
                        <IconX
                            :size='16'
                            stroke='2'
                        />
                    </TablerIconButton>
                </TablerBadge>
                <input
                    v-model='newTag'
                    :placeholder='placeholder'
                    :disabled='disabled'
                    class='tag-entry-new-tag'
                    @keydown.delete.stop='removeLastTag'
                    @keydown='addNew'
                    @blur='handleInputBlur'
                    @focus='handleInputFocus'
                >
            </div>
        </div>
        <div
            v-if='error'
            class='invalid-feedback'
            v-text='error'
        />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { TablerBadge, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconX } from '@tabler/icons-vue';

type ValidateFn = (value: string) => string | false;
type ValidateProp = string | ValidateFn | RegExp;

interface Props {
    disabled?: boolean;
    modelValue?: string[];
    validate?: ValidateProp;
    addTagOnKeys?: number[];
    placeholder?: string;
    limit?: number;
    tagLength?: number;
    allowDuplicates?: boolean;
    addTagOnBlur?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    modelValue: () => [],
    validate: '',
    addTagOnKeys: () => [13, 188, 32],
    placeholder: '',
    limit: -1,
    tagLength: -1,
    allowDuplicates: false,
    addTagOnBlur: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string[]];
    'on-limit': [];
    'on-error': [error: Error];
    'on-focus': [event: FocusEvent];
    'on-blur': [event: FocusEvent | KeyboardEvent];
}>();

const isInputActive = ref(false);
const error = ref<string | null>(null);
const newTag = ref('');
const innerTags = ref<string[]>([]);
const tagEntryEl = ref<HTMLElement | null>(null);

const isLimit = computed(() => {
    const limitReached = props.limit > 0 && props.limit === innerTags.value.length;
    if (limitReached) emit('on-limit');
    return limitReached;
});

watch(() => props.modelValue, (value) => {
    if (JSON.stringify(value) !== JSON.stringify(innerTags.value)) {
        innerTags.value = [...value];
    }
}, { deep: true, immediate: true });

function focusNewTag(): void {
    const input = tagEntryEl.value?.querySelector<HTMLElement>('.tag-entry-new-tag');
    input?.focus();
}

function handleInputFocus(event: FocusEvent): void {
    isInputActive.value = true;
    emit('on-focus', event);
}

function handleInputBlur(e: FocusEvent): void {
    isInputActive.value = false;
    if (props.addTagOnBlur) addNew(e);
    emit('on-blur', e);
}

function addNew(e?: KeyboardEvent | FocusEvent): void {
    const keyShouldAddTag = e instanceof KeyboardEvent
        ? props.addTagOnKeys.indexOf(e.keyCode) !== -1
        : e == null;
    const typeIsNotBlur = e != null && e.type !== 'blur';

    if (isLimit.value) {
        makeItError('Exceeds max number of tags');
        return;
    } else if (!keyShouldAddTag && (typeIsNotBlur || !props.addTagOnBlur)) {
        makeItError(null);
        return;
    }

    makeItError(null);

    const validationError = validateIfNeeded(newTag.value);
    if (validationError) {
        makeItError(validationError);
        e?.preventDefault();
        return;
    }

    if (newTag.value && props.tagLength !== -1 && newTag.value.length > props.tagLength) {
        makeItError(`Exceeds ${props.tagLength} characters`);
        e?.preventDefault();
        return;
    }

    if (!props.allowDuplicates && innerTags.value.includes(newTag.value)) {
        makeItError(`Duplicate Tag: "${newTag.value}"`);
        e?.preventDefault();
        return;
    }

    if (newTag.value.trim() !== '') {
        innerTags.value.push(newTag.value.trim());
        newTag.value = '';
        emit('update:modelValue', innerTags.value);
    }

    e?.preventDefault();
}

function makeItError(message: string | null): void {
    if (message) {
        error.value = message;
        emit('on-error', new Error(message));
    } else {
        error.value = null;
    }
}

function validateIfNeeded(tagValue: string): string | false {
    if (!props.validate) return false;

    if (typeof props.validate === 'function') {
        return props.validate(tagValue);
    }

    if (props.validate instanceof RegExp) {
        return !props.validate.test(tagValue) ? `Validation failed for "${tagValue}"` : false;
    }

    if (typeof props.validate === 'string') {
        const regex = new RegExp(props.validate);
        return !regex.test(tagValue) ? `Validation failed for "${tagValue}"` : false;
    }

    return false;
}

function removeTag(index: number): void {
    innerTags.value.splice(index, 1);
    emit('update:modelValue', innerTags.value);
}

function removeLastTag(): void {
    if (newTag.value) return;
    innerTags.value.pop();
    emit('update:modelValue', innerTags.value);
}
</script>

<style lang="scss">
.tag-entry {
    border: var(--tblr-border-width) solid var(--tblr-border-color);
    min-height: 32px;
    line-height: 1.4 !important;
    overflow: hidden;
    cursor: text;
    text-align: left;
    -webkit-appearance: textfield;
    display: flex;
    flex-wrap: wrap;

    &.is-invalid {
        border-color: var(--tblr-danger);
    }

    &--focus {
        color: var(--tblr-body-color);
        background-color: var(--tblr-bg-forms);
        border-color: #83b7e8;
        outline: 0;
        box-shadow: var(--tblr-box-shadow-input),0 0 0 .25rem rgba(var(--tblr-primary-rgb),.25);
    }

    .tag-entry-content {
        width: 100%;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
    }

    .tag-entry-new-tag {
        background: transparent;
        border: 0;
        font-weight: 400;
        margin: 3px;
        outline: none;
        padding:0 4px;
        flex: 1;
        min-width: 80px;
        height: 27px;
    }
}
</style>


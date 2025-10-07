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
                <span
                    v-for='(tag, index) in innerTags'
                    :key='index'
                    class='mx-1 my-1 d-flex badge badge-outline bg-blue-lt'
                    style='height: 24px;'
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
                        @click.prevent.stop='innerTags.splice(index, 1);'
                    ><IconX
                        :size='16'
                        stroke='2'
                    />
                    </TablerIconButton>
                </span>
                <input
                    v-model='newTag'
                    :placeholder='placeholder'
                    :disabled='disabled'
                    class='tag-entry-new-tag'
                    @keydown.delete.stop='removeLastTag'
                    @keydown='addNew'
                    @blur='handleInputBlur'
                    @focus='handleInputFocus'
                    @input='handleInput'
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

<script setup>
import { ref, watch, computed } from 'vue';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconX
} from '@tabler/icons-vue';

// Props
const props = defineProps({
    disabled: {
        type: Boolean,
        default: false
    },
    modelValue: {
        type: String,
        default: '',
    },
    validate: {
        type: [String, Function, Object],
        default: ""
    },
    addTagOnKeys: {
        type: Array,
        default: () => [
            13, // Enter
            188, // Comma ','
            32, // Space
        ]
    },
    placeholder: {
        type: String,
        default: ''
    },
    tags: {
        type: Array,
        default: () => []
    },
    limit: {
        type: Number,
        default: -1
    },
    tagLength: {
        type: Number,
        default: -1
    },
    allowDuplicates: {
        type: Boolean,
        default: false
    },
    addTagOnBlur: {
        type: Boolean,
        default: false
    },
});

// Emits
const emit = defineEmits(['update:modelValue', 'on-limit', 'tags', 'on-error', 'on-focus', 'on-blur']);

// State
const isInputActive = ref(false);
const error = ref(false);
const newTag = ref('');
const innerTags = ref([]);
const tagEntryEl = ref(null); // Template ref

// Computed
const isLimit = computed(() => {
    const limitReached = props.limit > 0 && Number(props.limit) === innerTags.value.length;
    if (limitReached) {
        emit('on-limit');
    }
    return limitReached;
});

// Watchers
watch(() => props.modelValue, (value) => {
    newTag.value = value;
}, { immediate: true });

watch(() => props.tags, (tags) => {
    innerTags.value = [...tags];
    emit('tags', innerTags.value);
}, { deep: true, immediate: true });


// Methods
function focusNewTag() {
    if (tagEntryEl.value) {
        const input = tagEntryEl.value.querySelector(".tag-entry-new-tag");
        if (input) {
            input.focus();
        }
    }
}

function handleInputFocus(event) {
    isInputActive.value = true;
    emit('on-focus', event);
}

function handleInputBlur(e) {
    isInputActive.value = false;
    if (props.addTagOnBlur) {
        addNew(e);
    }
    emit('on-blur', e);
}

function addNew(e) {
    const keyShouldAddTag = e ? props.addTagOnKeys.indexOf(e.keyCode) !== -1 : true;
    const typeIsNotBlur = e && e.type !== "blur";

    if (isLimit.value) {
        makeItError('Exceeds max number of tags');
        return;
    } else if (!keyShouldAddTag && (typeIsNotBlur || !props.addTagOnBlur)) {
        makeItError(false);
        return;
    }

    // Clear previous error before validation
    makeItError(false);

    const validationError = validateIfNeeded(newTag.value);
    if (validationError) {
        makeItError(validationError);
        if (e) e.preventDefault();
        return;
    }

    if (newTag.value && (props.tagLength !== -1 && newTag.value.length > props.tagLength)) {
        makeItError(`Exceeds ${props.tagLength} characters`);
        if (e) e.preventDefault();
        return;
    }

    if (!props.allowDuplicates && innerTags.value.includes(newTag.value)) {
        makeItError(`Duplicate Tag: "${newTag.value}"`);
        if (e) e.preventDefault();
        return;
    }

    if (newTag.value.trim() !== '') {
        innerTags.value.push(newTag.value.trim());
        newTag.value = '';
        emit('update:modelValue', '');
    }

    if (e) {
        e.preventDefault();
    }
}

function handleInput(event) {
    emit("update:modelValue", event.target.value);
}

function makeItError(errorMessage) {
    if (errorMessage) {
        error.value = errorMessage;
        emit('on-error', new Error(errorMessage));
    } else {
        error.value = false;
    }
}

function validateIfNeeded(tagValue) {
    if (!props.validate) {
        return false;
    }

    if (typeof props.validate === "function") {
        return props.validate(tagValue);
    }

    if (typeof props.validate === "object" && props.validate.test !== undefined) {
        // Assuming it's a RegExp object. If test fails, return an error message.
        return !props.validate.test(tagValue) ? `Validation failed for "${tagValue}"` : false;
    }

    // For string validation (assuming it's a regex pattern)
    if (typeof props.validate === 'string') {
        const regex = new RegExp(props.validate);
         return !regex.test(tagValue) ? `Validation failed for "${tagValue}"` : false;
    }

    return false;
}

function removeLastTag() {
    if (newTag.value) {
        return;
    }

    innerTags.value.pop();
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


<template>
    <div>
        <div
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

<script>
    import {
        TablerIconButton
    } from '@tak-ps/vue-tabler';
    import {
        IconX
    } from '@tabler/icons-vue';

    export default {
        components: {
            TablerIconButton,
            IconX
        },
        props: {
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
                default: function () {
                    return [
                        13, // Enter
                        188, // Comma ','
                        32, // Space
                    ];
                }
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
        },
        emits: ['update:modelValue', 'on-limit', 'tags', 'on-error', 'on-focus', 'on-blur'],
        data() {
            return {
                isInputActive: false,
                error: false,
                newTag: '',
                innerTags: []
            }
        },
        computed: {
            isLimit() {
                let isLimit = this.limit > 0 && Number(this.limit) === this.innerTags.length;
                if (isLimit) {
                    this.$emit('on-limit');
                }
                return isLimit;
            }
        },
        watch: {
            modelValue: {
                immediate: true,
                handler(value) {
                    this.newTag = value;
                }
            },
            tags: {
                deep: true,
                immediate: true,
                handler(tags) {
                    this.innerTags = [...tags];
                    this.$emit('tags', this.innerTags);
                }
            },
        },
        methods: {
            focusNewTag() {
                if (!this.$el.querySelector(".tag-entry-new-tag")) {
                    return;
                }

                this.$el.querySelector(".tag-entry-new-tag").focus();
            },
            handleInputFocus(event) {
                this.isInputActive = true;
                this.$emit('on-focus', event);
            },
            handleInputBlur(e) {
                this.isInputActive = false;
                this.addNew(e);
                this.$emit('on-blur', e);
            },
            addNew(e) {
                const keyShouldAddTag = e
                    ? this.addTagOnKeys.indexOf(e.keyCode) !== -1
                    : true;

                const typeIsNotBlur = e && e.type !== "blur";

                if (this.isLimit) {
                    this.makeItError('Exceeds max number of tags');
                    return;
                } else if (
                    !keyShouldAddTag && (typeIsNotBlur || !this.addTagOnBlur)
                ) {
                    this.makeItError(false)
                    return;
                }

                this.makeItError(this.validateIfNeeded(this.newTag));

                if (this.newTag && (this.tagLength !== -1 && this.newTag.length <= this.tagLength)) {
                    this.makeItError(`Exceeds ${this.tagLength} characters`);
                }

                if (!this.allowDuplicates && this.innerTags.includes(this.newTag)) {
                    this.makeItError(`Duplicate Tag`);
                }

                if (!this.error) {
                    this.innerTags.push(this.newTag);
                    this.newTag = '';
                    this.$emit('update:modelValue', '');
                }

                if (e) {
                    e.preventDefault();
                }
            },
            handleInput(event) {
                this.$emit("update:modelValue", event.target.value)
            },
            makeItError(errorMessage) {
                if (errorMessage) {
                    this.error = errorMessage
                    this.$emit('on-error', new Error(errorMessage));
                } else {
                    this.error = false;
                }
            },
            validateIfNeeded(tagValue) {
                if (this.validate === "" || this.validate === undefined) {
                    return false;
                }

                if (typeof this.validate === "function") {
                    return this.validate(tagValue);
                }

                if (
                    typeof this.validate === "object" &&
                    this.validate.test !== undefined
                ) {
                    return this.validate.test(tagValue);
                }

                return false;
            },
            removeLastTag() {
                if (this.newTag) {
                    return;
                }
                this.innerTags.pop();
            },
        }
    };
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

    &--focus {
        color: var(--tblr-body-color);
        background-color: var(--tblr-bg-forms);
        border-color: #83b7e8;
        outline: 0;
        box-shadow: var(--tblr-box-shadow-input),0 0 0 .25rem rgba(var(--tblr-primary-rgb),.25);
    }

    &--error{
        border-color: #F56C6C;
    }

    .tag-entry-content {
        width: 100%;
        display: flex;
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
        min-width: 60px;
        height: 27px;

        &--error {
            color: #F56C6C;
        }
    }
}
</style>


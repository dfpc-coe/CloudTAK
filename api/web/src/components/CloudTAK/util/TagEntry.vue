<template>
    <div @click="focusNewTag()"
        :class="{
            'tag-entry--focus': isInputActive,
            'tag-entry--error': isError
        }"
        class='form-control tag-entry my-2 py-1 px-1'
    >
        <div class="tag-entry-content">
            <span v-for="(tag, index) in innerTags"
                  :key="index"
                  class="tag-entry-tag">
                <slot v-if="$slots.item"
                      name="item" v-bind="{ name: tag, index }"></slot>
                <span v-else> {{ tag }} </span>
                <a v-if="!readOnly" @click.prevent.stop="remove(index)" class="tag-entry-remove-tag"></a>
            </span>
            <input
                ref="inputTag"
                :placeholder="placeholder"
                v-model="newTag"
                @keydown.delete.stop="removeLastTag"
                @keydown="addNew"
                @blur="handleInputBlur"
                @focus="handleInputFocus"
                @input="makeItNormal"
                class="tag-entry-new-tag"
            />
        </div>
    </div>
</template>

<script>
    export default {
        emits: ['update:modelValue', 'on-limit', 'on-tags-changed', 'on-remove', 'on-error', 'on-focus', 'on-blur'],
        props: {
            readOnly: {
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
        data() {
            return {
                isInputActive: false,
                isError: false,
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
            error() {
                this.isError = this.error;
            },
            modelValue: {
                immediate: true,
                handler(value) {
                    console.log('value: ', value)
                    this.newTag = value;
                }
            },
            tags: {
                deep: true,
                immediate: true,
                handler(tags) {
                    this.innerTags = [...tags];
                }
            },
            newTag() {
                if((this.tagLength !== -1 || this.newTag.length > this.tagLength)){
                    this.$refs.inputTag.className = 'tag-entry-new-tag tag-entry-new-tag--error';
                    this.$refs.inputTag.style.textDecoration="underline";
                }
            }
        },
        methods: {
            makeItNormal(event) {
                this.$emit('update:modelValue', event.target.value)
                this.$refs.inputTag.className = 'tag-entry-new-tag';
                this.$refs.inputTag.style.textDecoration="none";
            },
            resetData() {
                this.innerTags = []
            },
            focusNewTag() {
                if (this.readOnly || !this.$el.querySelector(".tag-entry-new-tag")) {
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
                if (
                    (!keyShouldAddTag && (typeIsNotBlur || !this.addTagOnBlur)) ||
                    this.isLimit
                ) {
                    return;
                }
                if (
                    this.newTag &&
                    (this.allowDuplicates || this.innerTags.indexOf(this.newTag) === -1) &&
                    this.validateIfNeeded(this.newTag) && (this.tagLength === -1 || this.newTag.length <= this.tagLength)
                ) {
                    this.innerTags.push(this.newTag);
                    this.newTag = "";
                    this.$emit('update:modelValue', '');
                    this.tagChange();
                    e && e.preventDefault();
                } else {
                    if(this.validateIfNeeded(this.newTag)){
                        if(this.newTag && (this.tagLength === -1 || this.newTag.length <= this.tagLength)) {
                            this.makeItError(true);
                        }else {
                            this.makeItError('maxLength');
                        }
                    } else {
                        this.makeItError(false);
                    }
                    e && e.preventDefault();
                }
            },
            makeItError(isDuplicatedOrMaxLength) {
                this.$refs.inputTag.className = 'tag-entry-new-tag tag-entry-new-tag--error';
                this.$refs.inputTag.style.textDecoration="underline";
                this.$emit('on-error', isDuplicatedOrMaxLength);
            },
            validateIfNeeded(tagValue) {
                if (this.validate === "" || this.validate === undefined) {
                    return true;
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
                return true;
            },
            removeLastTag() {
                if (this.newTag) {
                    return;
                }
                this.innerTags.pop();
                this.tagChange();
            },
            remove(index) {
                this.innerTags.splice(index, 1);
                this.tagChange();
                this.$emit("on-remove", index)
            },
            tagChange() {
                this.$emit("on-tags-changed", this.innerTags);
            }
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

    .tag-entry-tag {
        display: flex;
        font-weight: 400;
        margin: 3px;
        padding: 0 5px;
        background: #317CAF;
        color: #ffffff;
        height: 27px;
        border-radius: 5px;
        align-items: center;
        .tag-entry-remove-tag {
            color: #ffffff;
            transition: opacity .3s ease;
            opacity: .5;
            cursor: pointer;
            padding: 0 5px 0 7px;
            &::before {
                content: "x";
            }
            &:hover {
                opacity: 1;
            }
        }
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


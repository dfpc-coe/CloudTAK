<template>
    <div class='card-header px-1 pb-1 pt-2'>
        Style Editor
        <div class='ms-auto'>
            <IconCode
                v-if='mode === "visual"'
                v-tooltip='"Code View"'
                class='cursor-pointer'
                :size='32'
                stroke='1'
                @click='mode = "code"'
            />
            <IconEye
                v-if='mode === "code"'
                v-tooltip='"Visual View"'
                class='cursor-pointer'
                :size='32'
                stroke='1'
                @click='mode = "visual"'
            />
        </div>
    </div>

    <template v-if='mode === "code"'>
        <TablerInput
            v-model='styles'
            placeholder='GL JS Style JSON'
            :rows='30'
        />
    </template>
    <template v-else>
        <div
            v-for='l of layers'
            :key='l.id'
        >
            <template v-if='["fill", "line", "circle"].includes(l.type)'>
                <div
                    class='hover-light cursor-pointer'
                    @click='open.has(l.id) ? open.delete(l.id) : open.add(l.id)'
                >
                    <div class='px-3 py-2 align-items-center'>
                        <IconPaint
                            v-if='l.type === "fill"'
                            :size='24'
                            :stroke='1'
                        />
                        <IconLine
                            v-else-if='l.type === "line"'
                            :size='24'
                            :stroke='1'
                        />
                        <IconCircle
                            v-else-if='l.type === "circle"'
                            :size='24'
                            :stroke='1'
                        />

                        <span
                            class='user-select-none mx-2'
                            v-text='l.id || l.name'
                        />
                    </div>
                </div>
            </template>
            <div v-if='open.has(l.id)'>
                <StyleLayer :layer='l' />
            </div>
        </div>
    </template>
</template>

<script>
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconEye,
    IconCode,
    IconPaint,
    IconLine,
    IconCircle,
} from '@tabler/icons-vue';
import StyleLayer from './Layer.vue';

export default {
    name: 'StylingContainer',
    components: {
        IconEye,
        IconCode,
        IconPaint,
        IconLine,
        IconCircle,
        StyleLayer,
        TablerInput
    },
    props: {
        modelValue: {
            type: String,
            required: true
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            styles: this.modelValue,
            open: new Set(),
            mode: 'visual'
        }
    },
    computed: {
        layers: function() {
            return JSON.parse(this.styles);
        }
    },
    watch: {
        modelValue: function() {
            this.styles = this.modelValue
        },
        styles: function() {
            this.$emit('update:modelValue', this.styles);
        }
    }
}
</script>

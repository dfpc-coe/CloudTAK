<template>
    <div class='card-header px-1 pb-1 pt-2'>
        Style Editor
        <div class='ms-auto btn-list'>
            <template v-if='mode === "visual"'>
                <IconPlus
                    v-tooltip='"New Layer"'
                    class='cursor-pointer'
                    :size='32'
                    stroke='1'
                    @click='newLayer'
                />
                <IconCode
                    v-tooltip='"Code View"'
                    class='cursor-pointer'
                    :size='32'
                    stroke='1'
                    @click='mode = "code"'
                />
            </template>
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
            v-for='(l, l_it) of styles'
            :key='l.id'
        >
            <template v-if='["fill", "line", "circle"].includes(l.type)'>
                <div
                    class='hover-light cursor-pointer'
                    @click='open.has(l.id) ? open.delete(l.id) : open.add(l.id)'
                >
                    <div class='px-3 py-2 d-flex align-items-center'>
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

                        <div v-if='open.has(l.id)' @click.stop.prevent class='ms-auto btn-list'>
                            <IconCode
                                v-tooltip='"Code View"'
                                class='cursor-pointer'
                                @click='code.add(l.id)'
                                :size='32'
                                stroke='1'
                            />
                            <TablerDelete
                                v-tooltip='"Remove Layer"'
                                displaytype='icon'
                            />
                        </div>
                    </div>
                </div>
            </template>
            <div v-if='open.has(l.id)'>
                <template v-if='code.has(l.id)'>
                    <TablerInput v-model='styles[l_it]'/>
                </template>
                <StyleLayer v-else :layer='l' />
            </div>
        </div>
    </template>
</template>

<script>
import {
    TablerInput,
    TablerDelete,
} from '@tak-ps/vue-tabler';
import {
    IconEye,
    IconPlus,
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
        IconPlus,
        IconCode,
        IconPaint,
        IconLine,
        IconCircle,
        StyleLayer,
        TablerDelete,
        TablerInput
    },
    props: {
        modelValue: {
            type: Object,
            required: true
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            styles: JSON.parse(JSON.stringify(this.modelValue)),
            code: new Set(),
            open: new Set(),
            mode: 'visual'
        }
    },
    watch: {
        modelValue: function() {
            this.styles = JSON.parse(JSON.stringify(this.modelValue))
        },
        tyles: function() {
            this.$emit('update:modelValue', this.styles);
        }
    },
    methods: {
        newLayer: function() {
            this.styles.push({
                id: "new-layer",
                layout: {},
                paint: {}
            });
            this.open.add('new-layer');
        }
    }
}
</script>

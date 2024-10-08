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
        <ObjectInput
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
                    <IconAbc
                        v-else-if='l.type === "symbol"'
                        :size='24'
                        :stroke='1'
                    />
                    <IconCircle
                        v-else-if='l.type === "circle"'
                        :size='24'
                        :stroke='1'
                    />
                    <IconFlame
                        v-else-if='l.type === "heatmap"'
                        :size='24'
                        :stroke='1'
                    />
                    <IconCube
                        v-else-if='l.type === "fill-extrusion"'
                        :size='24'
                        :stroke='1'
                    />
                    <IconPhoto
                        v-else-if='l.type === "raster"'
                        :size='24'
                        :stroke='1'
                    />
                    <IconMountain
                        v-else-if='l.type === "hillshade"'
                        :size='24'
                        :stroke='1'
                    />
                    <IconBackground
                        v-else-if='l.type === "background"'
                        :size='24'
                        :stroke='1'
                    />
                    <IconQuestionMark
                        v-else
                        :size='24'
                        :stroke='1'
                    />

                    <span
                        class='user-select-none mx-2'
                        v-text='l.id || l.name'
                    />

                    <div
                        v-if='open.has(l.id)'
                        class='ms-auto btn-list'
                        @click.stop.prevent
                    >
                        <IconCode
                            v-if='!code.has(l.id)'
                            v-tooltip='"Code View"'
                            class='cursor-pointer'
                            :size='32'
                            stroke='1'
                            @click='code.add(l.id)'
                        />
                        <IconEye
                            v-else
                            v-tooltip='"Visual View"'
                            class='cursor-pointer'
                            :size='32'
                            stroke='1'
                            @click='code.delete(l.id)'
                        />

                        <TablerDelete
                            v-tooltip='"Remove Layer"'
                            displaytype='icon'
                            @delete='removeLayer(l, l_it)'
                        />
                    </div>
                </div>
            </div>
            <div v-if='open.has(l.id)'>
                <template v-if='code.has(l.id)'>
                    <ObjectInput v-model='styles[l_it]' />
                </template>
                <StyleLayer
                    v-else
                    :layer='l'
                    :update-map='false'
                />
            </div>
        </div>
    </template>
</template>

<script>
import {
    TablerDelete,
} from '@tak-ps/vue-tabler';
import ObjectInput from './ObjectInput.vue';
import {
    IconEye,
    IconPlus,
    IconAbc,
    IconCube,
    IconCode,
    IconPaint,
    IconLine,
    IconFlame,
    IconPhoto,
    IconCircle,
    IconMountain,
    IconBackground,
    IconQuestionMark
} from '@tabler/icons-vue';
import StyleLayer from './Layer.vue';

export default {
    name: 'StylingContainer',
    components: {
        IconEye,
        IconAbc,
        IconPlus,
        IconCube,
        IconCode,
        IconPaint,
        IconLine,
        IconPhoto,
        IconFlame,
        IconCircle,
        IconMountain,
        IconBackground,
        IconQuestionMark,
        StyleLayer,
        TablerDelete,
        ObjectInput,
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
        styles: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.styles);
            }
        }
    },
    methods: {
        removeLayer: function(l, i) {
            this.styles.splice(i, 1);
            this.open.delete(l.id)
            this.code.delete(l.id)
        },
        newLayer: function() {
            this.styles.push({
                id: "new-layer",
                type: 'circle',
                layout: {},
                paint: {}
            });
            this.open.add('new-layer');
        }
    }
}
</script>

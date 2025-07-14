<template>
    <div class='card-header px-1 pb-1 pt-2'>
        Style Editor
        <div class='ms-auto btn-list'>
            <template v-if='mode === "visual"'>
                <TablerIconButton
                    title='New Layer'
                    @click='newLayer'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Code View'
                    @click='mode = "code"'
                >
                    <IconCode
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </template>
            <TablerIconButton
                v-if='mode === "code"'
                title='Visual View'
                @click='mode = "visual"'
            >
                <IconEye
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
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
        <TablerNone
            v-if='!styles.length'
            :create='false'
        />
        <div
            v-for='(l, l_it) of styles'
            v-else
            :key='l.id'
        >
            <div
                class='hover cursor-pointer'
                @click='open.has(l.id) ? open.delete(l.id) : open.add(l.id)'
            >
                <div class='px-3 py-2 d-flex align-items-center'>
                    <IconPaint
                        v-if='l.type === "fill"'
                        :size='24'
                        stroke='1'
                    />
                    <IconLine
                        v-else-if='l.type === "line"'
                        :size='24'
                        stroke='1'
                    />
                    <IconAbc
                        v-else-if='l.type === "symbol"'
                        :size='24'
                        stroke='1'
                    />
                    <IconCircle
                        v-else-if='l.type === "circle"'
                        :size='24'
                        stroke='1'
                    />
                    <IconFlame
                        v-else-if='l.type === "heatmap"'
                        :size='24'
                        stroke='1'
                    />
                    <IconCube
                        v-else-if='l.type === "fill-extrusion"'
                        :size='24'
                        stroke='1'
                    />
                    <IconPhoto
                        v-else-if='l.type === "raster"'
                        :size='24'
                        stroke='1'
                    />
                    <IconMountain
                        v-else-if='l.type === "hillshade"'
                        :size='24'
                        stroke='1'
                    />
                    <IconBackground
                        v-else-if='l.type === "background"'
                        :size='24'
                        stroke='1'
                    />
                    <IconQuestionMark
                        v-else
                        :size='24'
                        stroke='1'
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
                        <TablerIconButton
                            v-if='!code.has(l.id)'
                            title='Code View'
                            @click='code.add(l.id)'
                        >
                            <IconCode
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerIconButton
                            v-else
                            title='Visual View'
                            @click='code.delete(l.id)'
                        >
                            <IconEye
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>

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
                    :advanced='advanced'
                    :update-map='false'
                />
            </div>
        </div>
    </template>
</template>

<script setup>
import { ref, watch } from 'vue';
import {
    TablerIconButton,
    TablerDelete,
    TablerNone,
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

const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    },
    advanced: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'update:modelValue'
]);

const styles = ref(JSON.parse(JSON.stringify(props.modelValue)))
const code = ref(new Set());
const open = ref(new Set());
const mode = ref('visual');

watch(styles, () => {
    emit('update:modelValue', styles.value);
});

watch(styles.value, () => {
    emit('update:modelValue', styles.value);
});

function removeLayer(l, i) {
    styles.value.splice(i, 1);
    open.value.delete(l.id)
    code.value.delete(l.id)
}

function newLayer() {
    styles.value.push({
        id: "new-layer",
        type: 'circle',
        layout: {},
        paint: {}
    });
    open.value.add('new-layer');
}
</script>

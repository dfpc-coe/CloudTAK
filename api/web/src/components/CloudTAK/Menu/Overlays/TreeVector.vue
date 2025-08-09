<template>
    <div class='ms-3'>
        <div
            v-for='l of overlay.styles'
            :key='l.id'
        >
            <template v-if='["fill", "line", "circle", "symbol"].includes(l.type)'>
                <div class='me-2'>
                    <div class='px-3 py-2 d-flex align-items-center hover-button'>
                        <IconChevronRight
                            v-if='!treeState[l.id]'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState[l.id] = true'
                        />
                        <IconChevronDown
                            v-else-if='treeState[l.id]'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState[l.id] = false'
                        />
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
                        <IconCircle
                            v-else-if='l.type === "circle"'
                            :size='24'
                            stroke='1'
                        />
                        <IconAbc
                            v-else-if='l.type === "symbol"'
                            :size='24'
                            stroke='1'
                        />

                        <span
                            class='user-select-none mx-2'
                            v-text='l.id || l.name'
                        />

                        <div class='ms-auto btn-list'>
                            <TablerIconButton
                                title='View Raw Style'
                                @click='layerModal = l'
                            >
                                <IconCode
                                    :size='24'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>

                    <StyleLayer
                        v-if='treeState[l.id]'
                        :layer='l'
                    />
                </div>
            </template>
        </div>
    </div>

    <JSONModal
        v-if='layerModal'
        title='Layer Style'
        :object='layerModal'
        :pre='true'
        @close='layerModal = undefined'
    />
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import StyleLayer from '../../../ETL/Styling/Layer.vue';
import {
    TablerIconButton,
} from '@tak-ps/vue-tabler'
import JSONModal from '../../util/JSONModal.vue';
import {
    IconChevronDown,
    IconChevronRight,
    IconCode,
    IconAbc,
    IconPaint,
    IconLine,
    IconCircle,
} from '@tabler/icons-vue';

const props = defineProps({
    overlay: {
        type: Object,
        required: true
    }
});

const treeState = ref<Record<number, boolean>>({});

const layerModal = ref<object | undefined>(undefined);

onMounted(() => {
    for (const layer of props.overlay.styles) {
        treeState.value[layer.id] = false;
    }
})
</script>

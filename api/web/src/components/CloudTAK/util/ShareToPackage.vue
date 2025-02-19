<template>
    <div class='mb-2'>
        <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
            <span class='subheader mx-2'>Create Data Package</span>
            <div
                v-if='compact'
                class='ms-auto'
            >
                <TablerIconButton
                    title='Cancel Share'
                    class='mx-2 my-2'
                    @click='emit("cancel")'
                >
                    <IconX
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>


        <TablerLoading v-if='loading' />
        <div
            v-else
            class='row mx-2'
        >
            <div class='col-12'>
                <TablerInput
                    v-model='body.name'
                    label='Package Name'
                />
            </div>
            <div class='col-12 pt-3'>
                <TablerButton
                    class='w-100'
                    @click='share'
                >
                    Create
                </TablerButton>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import type { PropType } from 'vue';
import {
    TablerLoading,
    TablerButton,
    TablerInput,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import { std } from '../../../std.ts';
import COT from '../../../base/cot.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    IconX,
} from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import type { Feature, Content } from '../../../types.ts';

const mapStore = useMapStore();
const router = useRouter();

const props = defineProps({
    feats: {
        type: Array as PropType<Array<Feature>>,
        required: true
    },
    compact: {
        type: Boolean,
        default: false
    },
    maxheight: {
        type: String,
        default: '100%'
    }
});

const emit = defineEmits(['cancel', 'done']);

const loading = ref(false);

const body = ref({
    name: ''
})

/** Feats often come from Vector Tiles which don't contain the full feature */
async function currentFeats(): Array<Feature> {
    return (props.feats || []).map(async (f) => {
        if (f.properties.type === 'b-f-t-r') {
            // FileShare is manually generated and won't exist in CoT Store
            return f;
        } else {
            return await mapStore.worker.db.get(f.id) || f;
        }
    }).filter((f) => {
        return !!f;
    }).map((f) => {
        if (f instanceof COT) {
            return f.as_feature();
        } else {
            return f;
        }
    })
}

async function share() {
    const feats = await currentFeats();

    loading.value = true;

    const content = await std('/api/marti/package', {
        method: 'PUT',
        body: {
            type: 'FeatureCollection',
            name: body.value.name,
            public: true,
            features: feats.map((f) => {
                f = JSON.parse(JSON.stringify(f));
                return { id: f.id || f.properties.id, type: f.type, properties: f.properties, geometry: f.geometry }
            })
        }
    }) as Content;

    emit('done');

    router.push(`/menu/packages/${content.Hash}`);

}
</script>

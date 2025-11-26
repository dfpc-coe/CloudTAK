<template>
    <div class='w-100 px-0'>
        <div
            class='sticky-top col-12 bg-dark'
            :style='`z-index: ${zindex};`'
            style='
                border-radius: 0px;
            '
            :class='{
                "border-bottom border-light": border
            }'
        >
            <div class='card-header py-2 px-0 mx-2'>
                <TablerIconButton
                    v-if='backType === "close"'
                    title='Close Menu'
                    @click='router.push("/")'
                >
                    <IconCircleX
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-if='backType === "back"'
                    title='Close Menu'
                    icon='IconCircleArrowLeft'
                    @click='routerBack'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <div v-else />

                <div
                    class='strong d-flex mx-auto user-select-none'
                    v-text='name'
                />
                <div class='col-auto btn-list align-items-center'>
                    <slot name='buttons' />
                </div>
            </div>
        </div>

        <div
            class='row mx-0 d-flex flex-row overflow-y-auto overflow-x-hidden align-content-start'
            style='height: calc(100vh - 114px)'
        >
            <TablerLoading
                v-if='loading'
                :desc='`Loading ${name}`'
            />
            <TablerNone
                v-else-if='none'
                :label='name'
                :create='false'
            />
            <slot v-else />
        </div>
    </div>
</template>

<script setup lang='ts'>

import {
    TablerNone,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

import {
    IconCircleX,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

import { useRouter } from 'vue-router'
import { computed } from 'vue';

const router = useRouter()

const props = defineProps({
    name: {
        type: String,
        required: true
    },
    zindex: {
        type: Number,
        default: 1020
    },
    border: {
        type: Boolean,
        default: true
    },
    back: {
        type: Boolean,
        default: true
    },
    loading: {
        type: Boolean,
        default: false,
    },
    none: {
        type: Boolean,
        default: false,
    }
});

function routerBack() {
    if (!router.options.history.state.back || String(router.options.history.state.back).startsWith('/login')) {
        router.push("/")
    } else {
        router.back();
    }
}

const backType = computed(() => {
    if (!props.back) return "none";

    if (
        !router.options.history.state.back
        || router.options.history.state.back === '/'
    ) {
        return 'close'
    } else {
        return 'back'
    }
});
</script>

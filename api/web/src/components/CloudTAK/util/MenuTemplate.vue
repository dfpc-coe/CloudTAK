<template>
    <TablerModal
        v-if='isModal'
        size='xl'
    >
        <div
            class='main-menu-modal-frame w-100 px-0 d-flex flex-column overflow-hidden'
        >
            <div class='modal-header d-flex align-items-center py-2 px-2 flex-shrink-0'>
                <TablerIconButton
                    v-if='backType === "back"'
                    title='Back'
                    @click='routerBack'
                >
                    <IconCircleArrowLeft
                        :size='28'
                        stroke='1'
                    />
                </TablerIconButton>

                <div
                    v-if='$slots.header'
                    class='flex-grow-1 d-flex align-items-center'
                    style='min-width: 0'
                >
                    <slot
                        name='header'
                        :is-modal='true'
                    />
                </div>
                <div
                    v-else
                    class='modal-title flex-grow-1 text-break px-1'
                    style='min-width: 0'
                    v-text='name'
                />

                <div class='btn-list align-items-center flex-nowrap'>
                    <slot name='buttons' />

                    <TablerIconButton
                        title='Close Menu'
                        @click='router.push("/")'
                    >
                        <IconCircleX
                            :size='28'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>

            <div
                class='d-flex flex-column overflow-x-hidden flex-grow-1 px-2'
                :class='scroll ? "overflow-y-auto" : "overflow-hidden"'
                style='min-height: 0'
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
                <div class='menu-scroll-spacer flex-shrink-0' />
            </div>

            <slot name='footer' />
        </div>
    </TablerModal>
    <div
        v-else
        class='w-100 px-0 d-flex flex-column overflow-hidden'
        :class='standalone ? "" : "flex-grow-1"'
        :style='standalone ? "height: calc(100vh - 64px - var(--map-bottom-bar-size, 0px)); max-height: 100%;" : "min-height: 0"'
    >
        <div
            class='col-12 cloudtak-bg flex-shrink-0'
            :style='`z-index: ${zindex};`'
            style='
                border-radius: 0px;
            '
            :class='{
                "border-bottom border-light": border
            }'
        >
            <div class='card-header d-flex align-items-center py-2 px-0 mx-2 flex-wrap row-gap-2'>
                <div
                    class='d-flex align-items-center flex-grow-1'
                    style='min-width: 0'
                >
                    <TablerIconButton
                        v-if='backType === "back"'
                        title='Back'
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
                        v-if='$slots.header'
                        class='flex-grow-1 d-flex align-items-center'
                        style='min-width: 0'
                    >
                        <slot
                            name='header'
                            :is-modal='false'
                        />
                    </div>
                    <div
                        v-else
                        class='strong user-select-none text-break px-2'
                        v-text='name'
                    />
                </div>
                <div class='col-auto btn-list align-items-center'>
                    <slot name='buttons' />
                </div>
            </div>
        </div>

        <div
            class='d-flex flex-column overflow-x-hidden flex-grow-1 px-2'
            :class='scroll ? "overflow-y-auto" : "overflow-hidden"'
            :style='standalone ? "" : "min-height: 0"'
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
            <div class='menu-scroll-spacer flex-shrink-0' />
        </div>

        <slot name='footer' />
    </div>
</template>

<script setup lang='ts'>

import {
    TablerNone,
    TablerModal,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

import {
    IconCircleX,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

import { useRouter } from 'vue-router'
import { computed } from 'vue';
import { useAppStore } from '../../../stores/app.ts';

const router = useRouter()
const appStore = useAppStore();

const props = defineProps({
    name: {
        type: String,
        default: ''
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
    },
    standalone: {
        type: Boolean,
        default: true,
    },
    scroll: {
        type: Boolean,
        default: true,
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

const isModal = computed(() => props.standalone && appStore.isMobileDetected);
</script>

<style scoped>
/*
 * On mobile a standalone menu is presented as a near-fullscreen modal so the
 * title/buttons live in a single modal header instead of a stacked double
 * header. Mirrors the previous MainMenu modal frame sizing.
 */
.main-menu-modal-frame {
    height: calc(100dvh - 2rem);
    max-height: calc(100dvh - 2rem);
}

/*
 * Ensure the final menu item is never flush against the bottom of the
 * display. env(safe-area-inset-bottom) accounts for device hardware that
 * intrudes on the viewport (notches, home indicators, curved screen edges)
 * while the additional buffer keeps the last item comfortably reachable.
 *
 * Note: padding-bottom on overflow-y:auto flex containers is ignored by many
 * browsers, so a spacer element is used instead to guarantee scroll clearance.
 */
.menu-scroll-spacer {
    height: calc(env(safe-area-inset-bottom, 0px) + 32px);
}
</style>


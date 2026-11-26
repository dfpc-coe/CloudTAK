<template>
    <TablerModal
        v-if='isModal'
        v-model:height='sheetHeight'
        size='xl'
        swipeable
        :min-height='SHEET_MIN_HEIGHT'
        @close='router.push("/")'
    >
        <div
            class='main-menu-modal-frame w-100 px-0 d-flex flex-column overflow-hidden'
        >
            <div
                class='modal-header d-flex align-items-center py-2 px-2 flex-shrink-0'
                data-modal-swipe
            >
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
                    class='flex-grow-1 d-flex flex-column px-1'
                    style='min-width: 0'
                >
                    <div
                        class='modal-title text-break'
                        v-text='name'
                    />
                    <div
                        v-if='subtitle'
                        class='menu-subtitle small text-truncate'
                        v-text='subtitle'
                    />
                </div>

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
                <div
                    v-if='scroll'
                    class='menu-scroll-spacer flex-shrink-0'
                />
            </div>

            <slot name='footer' />
        </div>
    </TablerModal>
    <div
        v-else
        class='w-100 px-0 d-flex flex-column overflow-hidden'
        :class='standalone ? "" : "flex-grow-1"'
        :style='standalone ? "height: 100%; max-height: 100%;" : "min-height: 0"'
    >
        <div
            class='col-12 cloudtak-header flex-shrink-0'
            :style='`z-index: ${zindex};`'
            style='
                border-radius: 0px;
            '
            :class='{
                "border-bottom": border
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
                        class='d-flex flex-column user-select-none px-2'
                        style='min-width: 0'
                    >
                        <div
                            class='strong text-break'
                            v-text='name'
                        />
                        <div
                            v-if='subtitle'
                            class='menu-subtitle small text-truncate'
                            v-text='subtitle'
                        />
                    </div>
                </div>
                <div class='col-auto btn-list align-items-center menu-header-buttons'>
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
            <div
                v-if='scroll'
                class='menu-scroll-spacer flex-shrink-0'
            />
        </div>

        <slot name='footer' />
    </div>
</template>

<script lang='ts'>
import { ref } from 'vue';

const SHEET_MIN_HEIGHT = 0.5;

// Shared by every menu so the height the user dragged to survives moving between menus
const sheetHeight = ref(1);
</script>

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
    subtitle: {
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

if (sheetHeight.value < SHEET_MIN_HEIGHT) sheetHeight.value = 1;

const isModal = computed(() => props.standalone && appStore.isMobileDetected);
</script>

<style scoped>
.menu-subtitle {
    color: var(--tblr-secondary-color);
}

/* Matches a 32px TablerIconButton so the header stays the same height when the buttons slot is empty */
.menu-header-buttons {
    min-height: 34px;
}

/* Mobile standalone menu is shown as a near-fullscreen modal with a single header.
 * The status bar inset is subtracted twice to keep the modal's top edge clear of
 * the transparent native status bar. --tblr-modal-sheet is the fraction of that
 * height the user has dragged the modal to. */
.main-menu-modal-frame {
    height: calc((100dvh - 2rem - 2 * var(--status-bar-height, 0px)) * var(--tblr-modal-sheet, 1));
    max-height: calc((100dvh - 2rem - 2 * var(--status-bar-height, 0px)) * var(--tblr-modal-sheet, 1));
}

/*
 * Spacer (not padding-bottom, which is ignored on overflow-y:auto flex containers)
 * keeps the last item clear of device intrusions via env(safe-area-inset-bottom).
 */
.menu-scroll-spacer {
    height: calc(env(safe-area-inset-bottom, 0px) + 32px);
}
</style>


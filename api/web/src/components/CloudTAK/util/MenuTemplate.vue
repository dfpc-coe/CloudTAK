<template>
    <div class='container px-0'>
        <div
            class='sticky-top col-12 bg-dark'
            style='border-radius: 0px;'
            :class='{
                "border-bottom border-light": border
            }'
        >
            <div class='modal-header px-0 mx-2'>
                <IconCircleX
                    v-if='backType === "close"'
                    role='button'
                    tabindex='0'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='$router.push("/")'
                />
                <IconCircleArrowLeft
                    v-if='backType === "back"'
                    role='button'
                    tabindex='0'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='$router.back()'
                />
                <div v-else />

                <div
                    class='modal-title d-flex mx-auto'
                    v-text='name'
                />
                <div class='btn-list'>
                    <slot name='buttons' />
                </div>
            </div>
        </div>

        <div
            class='col-12 overflow-auto'
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

<script>
import {
    IconCircleX,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'
import {
    TablerNone,
    TablerLoading,
} from '@tak-ps/vue-tabler';

export default {
    name: 'MenuTemplate',
    components: {
        TablerNone,
        TablerLoading,
        IconCircleX,
        IconCircleArrowLeft,
    },
    props: {
        name: {
            type: String,
            required: true
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
    },
    computed: {
        backType: function() {
            if (!this.back) return "none";

            if (
                !this.$router.options.history.state.back
                || this.$router.options.history.state.back === '/'
            ) {
                return 'close'
            } else {
                return 'back'
            }
        }
    }
}
</script>

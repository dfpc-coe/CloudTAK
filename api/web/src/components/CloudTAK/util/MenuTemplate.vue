<template>
    <div class='container px-0'>
        <div class='sticky-top col-12 border-bottom border-light bg-dark'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft
                    size='32'
                    class='cursor-pointer'
                    @click='$router.back()'
                />

                <div
                    class='modal-title'
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
        IconCircleArrowLeft,
    },
    props: {
        name: {
            type: String,
            required: true
        },
        loading: {
            type: Boolean,
            default: false,
        },
        empty: {
            type: Boolean,
            default: false,
        }
    }
}
</script>

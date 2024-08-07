<template>
    <div class='page page-center'>
        <div class='container container-normal py-4'>
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <div
                                    class='text-center'
                                    style='margin-bottom: 24px;'
                                >
                                    <img
                                        alt='Agency Logo'
                                        src='/logo.png'
                                        height='150'
                                    >
                                </div>
                                <TablerLoading desc='Loading CloudTAK' />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'MainLoading',
    components: {
        TablerLoading
    }
}
</script>

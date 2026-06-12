<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Chemical Sensor'
        >
            <template #icon>
                <IconFlask
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

            <div class='mx-2 py-2'>
                <div class='rounded px-2 cloudtak-accent pb-2'>
                    <!-- Sensor Info -->
                    <div class='d-flex align-items-center mt-2 mb-3'>
                        <IconInfoCircle
                            :size='16'
                            stroke='1'
                            class='me-2 text-muted'
                        />
                        <label class='subheader m-0'>Sensor Information</label>
                    </div>
                    <div class='datagrid'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Manufacturer
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='chemsensordetail.sensor_data.manufacturer'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Model
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='chemsensordetail.sensor_data.model'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Serial Number
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='chemsensordetail.sensor_data.serialnumber'
                            />
                        </div>
                        <div
                            v-if='chemsensordetail.sensor_data.batterylevel !== undefined'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Battery
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='chemsensordetail.sensor_data.batterylevel + "%"'
                            />
                        </div>
                        <div
                            v-if='chemsensordetail.sensor_data.status'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Status
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='chemsensordetail.sensor_data.status'
                            />
                        </div>
                        <div
                            v-if='chemsensordetail.sensor_data.callsign'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Callsign
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='chemsensordetail.sensor_data.callsign'
                            />
                        </div>
                    </div>

                    <!-- Detections -->
                    <div
                        v-if='chemsensordetail.detection && chemsensordetail.detection.length > 0'
                        class='mt-4'
                    >
                        <div class='d-flex align-items-center mb-3'>
                            <IconAlertTriangle
                                :size='16'
                                stroke='1'
                                class='me-2 text-muted'
                            />
                            <label class='subheader m-0'>Detections</label>
                        </div>
                        <div class='table-responsive rounded mt-1'>
                            <table class='table card-table table-hover table-vcenter datatable table-sm'>
                                <thead>
                                    <tr>
                                        <th>Agent</th>
                                        <th>Quantity</th>
                                        <th>Class</th>
                                        <th>Alarm</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for='(detection, idx) in chemsensordetail.detection'
                                        :key='idx'
                                    >
                                        <td v-text='detection.agent' />
                                        <td v-text='detection.quantity.toFixed(2) + " " + detection.quantityunits' />
                                        <td v-text='detection.class || "-"' />
                                        <td>
                                            <span
                                                :class='detection.alarm === 1 ? "text-danger fw-bold" : "text-muted"'
                                                v-text='detection.alarm === 1 ? "ALARM" : "Normal"'
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { IconFlask, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';

interface ChemSensorData {
    manufacturer: string;
    model: string;
    serialnumber: string;
    batterylevel?: number;
    callsign?: string;
    status?: string;
}

interface ChemDetection {
    agent: string;
    quantity: number;
    quantityunits: string;
    alarm: number;
    class?: string;
    confidence?: number;
    concentration?: number;
    massfraction?: number;
    percent?: number;
    id?: number;
    time: string;
}

interface ChemSensorDetail {
    sensor_data: ChemSensorData;
    detection?: ChemDetection[];
}

defineProps<{
    chemsensordetail: ChemSensorDetail
}>();

const expanded = ref(false);
</script>

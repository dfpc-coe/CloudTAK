<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Radiation Sensor'
        >
            <template #icon>
                <IconRadioactive
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
                                v-text='radsensordetail.sensor_data.manufacturer'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Model
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='radsensordetail.sensor_data.model'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Serial Number
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='radsensordetail.sensor_data.serialnumber'
                            />
                        </div>
                        <div
                            v-if='radsensordetail.sensor_data.batterylevel !== undefined'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Battery
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='radsensordetail.sensor_data.batterylevel + "%"'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Gamma Status
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='radsensordetail.sensor_data.gammastatus'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Neutron Status
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='radsensordetail.sensor_data.neutronstatus'
                            />
                        </div>
                        <div
                            v-if='radsensordetail.sensor_data.callsign'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Callsign
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='radsensordetail.sensor_data.callsign'
                            />
                        </div>
                    </div>

                    <!-- Measurements -->
                    <div
                        v-if='radsensordetail.radmeasurement && radsensordetail.radmeasurement.length > 0'
                        class='mt-4'
                    >
                        <div class='d-flex align-items-center mb-3'>
                            <IconChartBar
                                :size='16'
                                stroke='1'
                                class='me-2 text-muted'
                            />
                            <label class='subheader m-0'>Measurements</label>
                        </div>
                        <div class='table-responsive rounded mt-1'>
                            <table class='table card-table table-hover table-vcenter datatable table-sm'>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Value</th>
                                        <th>Alarm</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for='(measurement, idx) in radsensordetail.radmeasurement'
                                        :key='idx'
                                    >
                                        <td
                                            class='text-capitalize'
                                            v-text='measurement.name'
                                        />
                                        <td v-text='formatMeasurement(measurement)' />
                                        <td>
                                            <span
                                                :class='measurement.alarm === 1 ? "text-danger fw-bold" : "text-muted"'
                                                v-text='measurement.alarm === 1 ? "ALARM" : "Normal"'
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Isotopes -->
                    <div
                        v-if='radsensordetail.isotope && radsensordetail.isotope.length > 0'
                        class='mt-4'
                    >
                        <div class='d-flex align-items-center mb-3'>
                            <IconAtom
                                :size='16'
                                stroke='1'
                                class='me-2 text-muted'
                            />
                            <label class='subheader m-0'>Identified Isotopes</label>
                        </div>
                        <div class='table-responsive rounded mt-1'>
                            <table class='table card-table table-hover table-vcenter datatable table-sm'>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for='(isotope, idx) in radsensordetail.isotope'
                                        :key='idx'
                                    >
                                        <td v-text='isotope.name' />
                                        <td v-text='isotope.type' />
                                        <td v-text='isotope.confidence.toFixed(1) + "%"' />
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
import { ref, onMounted } from 'vue';
import { IconRadioactive, IconInfoCircle, IconChartBar, IconAtom } from '@tabler/icons-vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import ProfileConfig from '../../../base/profile.ts';

interface RadSensorData {
    manufacturer: string;
    model: string;
    serialnumber: string;
    batterylevel?: number;
    callsign?: string;
    gammastatus: string;
    neutronstatus: string;
}

interface RadMeasurement {
    name: string;
    measurement: number;
    alarm: number;
    nalarmstddev: number;
}

interface RadIsotope {
    name: string;
    type: string;
    confidence: number;
}

interface RadSensorDetail {
    sensor_data: RadSensorData;
    radmeasurement?: RadMeasurement[];
    isotope?: RadIsotope[];
}

defineProps<{
    radsensordetail: RadSensorDetail
}>();

const expanded = ref(false);
const doseUnit = ref<'sieverts' | 'rems'>('sieverts');

onMounted(async () => {
    const setting = await ProfileConfig.get('display_radiation_dose');
    if (setting?.value === 'sieverts' || setting?.value === 'rems') {
        doseUnit.value = setting.value;
    }
});

function formatMeasurement(measurement: RadMeasurement): string {
    if (measurement.name !== 'doserate') {
        return measurement.measurement.toFixed(2) + ' CPS';
    }

    if (doseUnit.value === 'sieverts') {
        // 1 mR/hr ≈ 10 µSv/hr
        return (measurement.measurement * 10).toFixed(2) + ' µSv/hr';
    } else {
        // 1 mR/hr ≈ 1 mrem/hr
        return measurement.measurement.toFixed(2) + ' mrem/hr';
    }
}
</script>

import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/type/cot', async (t) => {
    try {
        const res = await flight.fetch('/api/type/cot?identity=f', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
             total: 1006,
             items: [{
                  "cot": "a-f-A",
                  "full": "Air/Air Track",
                  "desc": "Air Track"
              },
              {
                  "cot": "a-f-A-C",
                  "full": "Air/Civ",
                  "desc": "CIVIL AIRCRAFT"
              },
              {
                  "cot": "a-f-A-C-F",
                  "full": "Air/Civ/fixed",
                  "desc": "FIXED WING"
              },
              {
                  "cot": "a-f-A-C-F-q",
                  "full": "Air/Civ/fixed/rpv, drone, uav",
                  "desc": "FIXED WING RPV/Drone"
              },
              {
                  "cot": "a-f-A-C-H",
                  "full": "Air/Civ/rotary",
                  "desc": "ROTARY WING"
              },
              {
                  "cot": "a-f-A-C-L",
                  "full": "Air/Civ/Blimp",
                  "desc": "LIGHTER THAN AIR"
              },
              {
                  "cot": "a-f-A-M-F",
                  "full": "Air/Mil/Fixed",
                  "desc": "FIXED WING"
              },
              {
                  "cot": "a-f-A-M-F-g",
                  "full": "Air/Mil/Fixed/Gunship",
                  "desc": "FIXED WING GUNSHIP"
              },
              {
                  "cot": "a-f-A-M-F-A",
                  "full": "Air/Mil/Fixed/Attack/Strike",
                  "desc": "ATTACK/STRIKE"
              },
              {
                  "cot": "a-f-A-M-F-B",
                  "full": "Air/Mil/Fixed/Bomber",
                  "desc": "BOMBER"
             }]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/type/cot/a-f-A-M-F', async (t) => {
    try {
        const res = await flight.fetch('/api/type/cot/a-f-A-M-F', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            cot: 'a-f-A-M-F',
            full: 'Air/Mil/Fixed',
            desc: 'FIXED WING'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/type/cot/a-f-FAKE', async (t) => {
    try {
        const res = await flight.fetch('/api/type/cot/a-f-FAKE', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            cot: 'a-f-FAKE',
            full: 'a-f-FAKE',
            desc: 'Unknown CoT Type'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();

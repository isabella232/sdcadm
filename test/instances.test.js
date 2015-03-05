/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2015, Joyent, Inc.
 */


var test = require('tape').test;
var exec = require('child_process').exec;


var DEFAULT_SERVICES = [
    'adminui', 'amon', 'amonredis', 'assets', 'binder', 'ca', 'cnapi', 'dhcpd',
    'fwapi', 'imgapi', 'mahi', 'manatee', 'moray', 'napi', 'papi', 'rabbitmq',
    'redis', 'sapi', 'sdc', 'ufds', 'vmapi', 'workflow'
];

var INSTANCES_DETAILS = [];


test('sdcadm instances --help', function (t) {
    checkHelp(t, 'instances');
});


test('sdcadm insts --help', function (t) {
    checkHelp(t, 'insts');
});


test('sdcadm instances', function (t) {
    exec('sdcadm instances', function (err, stdout, stderr) {
        t.ifError(err);

        DEFAULT_SERVICES.forEach(function (svcName) {
            var found = stdout.indexOf(svcName) !== -1;
            t.ok(found, svcName + ' in instances output');
        });

        t.equal(stderr, '');

        // global, so other tests can compare against
        INSTANCES_DETAILS = parseInstancesOutput(stdout);
        t.ok(INSTANCES_DETAILS.length > 0);

        checkInstancesDetails(t, deepCopy(INSTANCES_DETAILS));
    });
});


test('sdcadm insts', function (t) {
    exec('sdcadm insts', function (err, stdout, stderr) {
        t.ifError(err);
        t.equal(stderr, '');

        t.deepEqual(parseInstancesOutput(stdout), INSTANCES_DETAILS);
        t.end();
    });
});


test('sdcadm instances -H', function (t) {
    exec('sdcadm instances -H', function (err, stdout, stderr) {
        t.ifError(err);
        t.equal(stderr, '');

        t.equal(stdout.indexOf('INSTANCE'), -1);

        t.end();
    });
});


test('sdcadm instances --json', function (t) {
    exec('sdcadm instances --json', function (err, stdout, stderr) {
        t.ifError(err);
        t.equal(stderr, '');

        var details;
        try {
            details = JSON.parse(stdout);
        } catch (e) {
            t.ok(false, 'parse --json output');
            details = {};
        }

        var vmsDetails = {};
        details.forEach(function (vm) {
            vmsDetails[vm.zonename] = vm;
        });

        INSTANCES_DETAILS.forEach(function (oldDetails) {
            var vmUuid = oldDetails[0];
            var jsonDetails = vmsDetails[vmUuid];
            t.equal(jsonDetails.type,    'vm',           vmUuid + ' type');
            t.equal(jsonDetails.service,  oldDetails[1], vmUuid + ' service');
            t.equal(jsonDetails.hostname, oldDetails[2], vmUuid + ' hostname');
            t.equal(jsonDetails.version,  oldDetails[3], vmUuid + ' version');
            t.equal(jsonDetails.alias,    oldDetails[4], vmUuid + ' alias');
        });

        t.end();
    });
});


test('sdcadm instances -o', function (t) {
    var cmd = 'sdcadm instances -o type,instance,version';
    exec(cmd, function (err, stdout, stderr) {
        t.ifError(err);
        t.equal(stderr, '');

        var data = stdout.split('\n').filter(function (r) {
            return r !== '';
        }).map(function (r) {
            return r.split(/\s+/);
        });

        var titles = data.shift();

        t.deepEqual(titles, ['TYPE', 'INSTANCE', 'VERSION']);

        // TODO: should check more than just vms
        var vms = data.filter(function (r) {
            return r[0] === 'vm';
        }).map(function (r) {
            return [ r[1], r[2] ];
        });

        var prevVms = INSTANCES_DETAILS.map(function (r) {
            return [ r[0], r[3] ];
        });

        t.deepEqual(vms, prevVms);

        t.end();
    });
});


test('sdcadm instances -s', function (t) {
    exec('sdcadm instances -s instance', function (err, stdout, stderr) {
        t.ifError(err);
        t.equal(stderr, '');

        var vms = parseInstancesOutput(stdout);
        var sortedVms = deepCopy(vms).sort(function (a, b) {
            if (a[0] < b[0]) {
                return -1;
            }
            return 1;
        });

        t.deepEqual(vms, sortedVms);

        t.end();
    });
});


function checkHelp(t, command) {
    exec('sdcadm ' + command + ' --help', function (err, stdout, stderr) {
        t.ifError(err);

        t.ok(stdout.indexOf('sdcadm instances [<options>]') !== -1);
        t.equal(stderr, '');

        t.end();
    });
}


function parseInstancesOutput(output) {
    return output.split('\n').filter(function (r) {
        return r !== '';
    }).map(function (r) {
        return r.split(/\s+/);
    }).filter(function (r) {
        // first row of output is column titles, which we don't want
        return r[0] !== 'INSTANCE';
    }).filter(function (r) {
        // TODO: we should check everything, not just VMs
        return r[4] !== '-';
    });
}


/*
 * Recursive function to check the existence of a VM, and its alias and version
 * are correct.
 */
function checkInstancesDetails(t, instancesDetails) {
    if (instancesDetails.length === 0) {
        return t.end();
    }

    var instanceDetails = instancesDetails.pop();
    var vmUuid  = instanceDetails[0];
    var version = instanceDetails[3];
    var alias   = instanceDetails[4];

    var cmd = 'sdc-vmapi /vms/' + vmUuid + ' | json -H';

    exec(cmd, function (err, stdout, stderr) {
        t.ifError(err);

        var vmInfo = JSON.parse(stdout);
        t.equal(vmInfo.alias, alias, 'check VM alias is ' + alias);
        t.notEqual(vmInfo.state, 'failed', 'check state for VM ' + vmUuid);

        var cmd2 = 'sdc-imgapi /images/' + vmInfo.image_uuid + ' | json -H';

        exec(cmd2, function (err2, stdout2, stderr2) {
            t.ifError(err2);

            var imgInfo = JSON.parse(stdout2);
            t.equal(imgInfo.version, version, 'check version for VM ' + vmUuid);

            checkInstancesDetails(t, instancesDetails); // recursive call
        });
    });
}


function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj)); // heh
}
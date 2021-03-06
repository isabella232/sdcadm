/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2019 Joyent, Inc.
 */

var vasync = require('vasync');

var errors = require('../errors');

/*
 * The 'sdcadm self-update' CLI subcommand.
 */
function do_self_update(subcmd, opts, args, cb) {
    var self = this;

    if (opts.help) {
        this.do_help('help', {}, [subcmd], cb);
        return;
    }

    var image = (opts.latest) ? 'latest' : args.shift();

    if (!image) {
        cb(new errors.UsageError(
        'Please provide an image UUID or use `sdcadm self-update --latest`\n' +
        'in order to update to the latest available image.'));
        return;
    }

    if (image === 'help') {
        cb(new errors.UsageError(
        'Please use `sdcadm help self-update` instead'));
        return;
    }

    vasync.pipeline({funcs: [
        function ensureSdcApp(_, next) {
            self.sdcadm.ensureSdcApp({}, next);
        },
        function setServer(_, next) {
            if (opts.source) {
                self.sdcadm.config.updatesServerUrl = opts.source;
            }
            next();
        },
        function setChannel(_, next) {
            // Set or override the default channel if anything is given:
            if (opts.channel) {
                self.sdcadm.updates.channel = opts.channel;
            }
            next();
        },
        function doSelfUpdate(_, next) {
            self.sdcadm.selfUpdate({
                progress: self.progress,
                allowMajorUpdate: opts.allow_major_update,
                dryRun: opts.dry_run,
                image: image
            }, next);
        }
    ]}, cb);

}

do_self_update.options = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    },
    {
        names: ['dry-run', 'n'],
        type: 'bool',
        help: 'Go through the motions without actually updating.'
    },
    {
        names: ['allow-major-update'],
        type: 'bool',
        help: 'Allow a major version update to sdcadm. By default major ' +
               'updates are skipped (to avoid accidental backward ' +
               'compatibility breakage).'
    },
    {
        names: ['channel', 'C'],
        type: 'string',
        help: 'Use the given channel to fetch the image, even if it is ' +
            'not the default one.'
    },
    {
        names: ['source', 'S'],
        type: 'string',
        help: 'An image source (url) from which to import.'
    },
    {
        names: ['latest'],
        type: 'bool',
        help: 'Get the latest available image.'
    }
];

do_self_update.help = (
    'Update "sdcadm" itself.\n' +
    '\n' +
    'Usage:\n' +
    '     # Update to the given image UUID:\n' +
    '     {{name}} self-update IMAGE_UUID [<options>]\n' +
    '     # Update to the latest available image:\n' +
    '     {{name}} self-update --latest [<options>]\n' +
    '     # Update from an imgapi server:\n' +
    '     {{name}} self-update -S http://imgapi.dc.example.com IMAGE_UUID\n' +
    '\n' +
    '{{options}}'
);

do_self_update.logToFile = true;

// --- exports

module.exports = {
    do_self_update: do_self_update
};

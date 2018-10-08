var bidfactory = require('../bidfactory.js');
var bidmanager = require('../bidmanager.js');
var utils = require('../utils.js');
var adloader = require('../adloader');
var constants = require('../constants.json');
var ajax = require('../ajax.js');
var prebidGlobal = require('../prebidGlobal.js');
const SCRIPT_BASE_URL = 'https://static-eb.media.net/rtb/prebid.js?ver=';

var MedianetBidAdapter = function MedianetBidAdapter() {
    function getScriptURL(version) {
        version = version || '';
        return SCRIPT_BASE_URL + version;
    }

    let _callBids = function(params) {
        window.mnetObject = window.mnetObject || {};
        var pbjs = prebidGlobal.getGlobal();
        var SCRIPT_URL = getScriptURL(pbjs.version);
        adloader.loadScript(SCRIPT_URL, function() {
            window.mnetObject.MnetUtils(pbjs, bidfactory, bidmanager, utils, adloader, constants, ajax, params).init();
        }, true);
    };

    return {
        callBids: _callBids
    };
};

module.exports = MedianetBidAdapter;
import {
  deepAccess,
  logInfo,
  pick,
  deepSetValue
} from '../src/utils.js';
import {config} from '../src/config.js';
import {getHook} from '../src/hook.js';

const MODULE_NAME = 'GPT Pre-Auction';
export let _currentConfig = {};
let hooksAdded = false;

window.adpushup = window.adpushup || {};
const adp = window.adpushup;
const adpConfig = adp.config || {};

window.adpTags = window.adpTags || {};
const adpTags = window.adpTags;
const adpSlots = adpTags.adpSlots || {};

const getAdUnitPath = function(code) {
  const adpSlot = adpSlots[code];
  if (!adpSlot) return null;
  const {childPublisherId,isMcmEnabled=false } = adpConfig.mcm;

  let dfpNetwork = adpSlot.activeDFPNetwork;
  if (isMcmEnabled) {
    dfpNetwork += `,${childPublisherId}`;
  }
  const dfpAdUnitCode = adpSlot.currentGptSlotData && adpSlot.currentGptSlotData.dfpAdunitCode;
  return `/${dfpNetwork}/${dfpAdUnitCode}`;
}

export const appendGptSlots = adUnits => {
  if (!adpSlots) {
    return; 
  }
  const adUnitMap = adUnits.reduce((acc, adUnit) => {
    acc[adUnit.code] = acc[adUnit.code] || [];
    acc[adUnit.code].push(adUnit);
    return acc;
  }, {});

  for (adUnit in adpSlots) {
    const matchingAdUnitCode = Object.keys(adUnitMap).find((key) => key === adUnit);
    if (matchingAdUnitCode) {
      const adserver = {
        name: "gam",
        adslot: sanitizeSlotPath(getAdUnitPath(adUnit)),
      };
      adUnitMap[matchingAdUnitCode].forEach((adUnit) => {
        deepSetValue(
          adUnit,
          "ortb2Imp.ext.data.adserver",
          Object.assign({}, adUnit.ortb2Imp?.ext?.data?.adserver, adserver)
        );
      });
    }
  }
};

const sanitizeSlotPath = (path) => {
  const gptConfig = config.getConfig('gptPreAuction') || {};

  if (gptConfig.mcmEnabled) {
    return path.replace(/(^\/\d*),\d*\//, '$1/');
  }

  return path;
}

const defaultPreAuction = (adUnit, adServerAdSlot) => {
  const context = adUnit.ortb2Imp.ext.data;

  // use pbadslot if supplied
  if (context.pbadslot) {
    return context.pbadslot;
  }

  if (!adpSlots) {
    return 
  }
  // find all GPT slots with this name
  var gptSlots = Object.keys(adpSlots).filter(slot => getAdUnitPath(slot) === adServerAdSlot);

  if (gptSlots.length === 0) {
    return; // should never happen
  }

  if (gptSlots.length === 1) {
    return adServerAdSlot;
  }

  // else the adunit code must be div id. append it.
  return `${adServerAdSlot}#${adUnit.code}`;
}

export const appendPbAdSlot = adUnit => {
  const context = adUnit.ortb2Imp.ext.data;
  const { customPbAdSlot } = _currentConfig;

  // use context.pbAdSlot if set (if someone set it already, it will take precedence over others)
  if (context.pbadslot) {
    return;
  }

  if (customPbAdSlot) {
    context.pbadslot = customPbAdSlot(adUnit.code, deepAccess(context, 'adserver.adslot'));
    return;
  }

  // use data attribute 'data-adslotid' if set
  try {
    const adUnitCodeDiv = document.getElementById(adUnit.code);
    if (adUnitCodeDiv.dataset.adslotid) {
      context.pbadslot = adUnitCodeDiv.dataset.adslotid;
      return;
    }
  } catch (e) {}
  // banner adUnit, use GPT adunit if defined
  if (deepAccess(context, 'adserver.adslot')) {
    context.pbadslot = context.adserver.adslot;
    return;
  }
  context.pbadslot = adUnit.code;
  return true;
};

export const makeBidRequestsHook = (fn, adUnits, ...args) => {
  appendGptSlots(adUnits);
  const { useDefaultPreAuction, customPreAuction } = _currentConfig;
  adUnits.forEach(adUnit => {
    // init the ortb2Imp if not done yet
    adUnit.ortb2Imp = adUnit.ortb2Imp || {};
    adUnit.ortb2Imp.ext = adUnit.ortb2Imp.ext || {};
    adUnit.ortb2Imp.ext.data = adUnit.ortb2Imp.ext.data || {};
    const context = adUnit.ortb2Imp.ext;

    // if neither new confs set do old stuff
    if (!customPreAuction && !useDefaultPreAuction) {
      const usedAdUnitCode = appendPbAdSlot(adUnit);
      // gpid should be set to itself if already set, or to what pbadslot was (as long as it was not adUnit code)
      if (!context.gpid && !usedAdUnitCode) {
        context.gpid = context.data.pbadslot;
      }
    } else {
      let adserverSlot = deepAccess(context, 'data.adserver.adslot');
      let result;
      if (customPreAuction) {
        result = customPreAuction(adUnit, adserverSlot);
      } else if (useDefaultPreAuction) {
        result = defaultPreAuction(adUnit, adserverSlot);
      }
      if (result) {
        context.gpid = context.data.pbadslot = result;
      }
    }
  });
  return fn.call(this, adUnits, ...args);
};

const handleSetGptConfig = moduleConfig => {
  _currentConfig = pick(moduleConfig, [
    'enabled', enabled => enabled !== false,
    'customGptSlotMatching', customGptSlotMatching =>
      typeof customGptSlotMatching === 'function' && customGptSlotMatching,
    'customPbAdSlot', customPbAdSlot => typeof customPbAdSlot === 'function' && customPbAdSlot,
    'customPreAuction', customPreAuction => typeof customPreAuction === 'function' && customPreAuction,
    'useDefaultPreAuction', useDefaultPreAuction => useDefaultPreAuction === true,
  ]);

  if (_currentConfig.enabled) {
    if (!hooksAdded) {
      getHook('makeBidRequests').before(makeBidRequestsHook);
      hooksAdded = true;
    }
  } else {
    logInfo(`${MODULE_NAME}: Turning off module`);
    _currentConfig = {};
    getHook('makeBidRequests').getHooks({hook: makeBidRequestsHook}).remove();
    hooksAdded = false;
  }
};

config.getConfig('gptPreAuction', config => handleSetGptConfig(config.gptPreAuction));
handleSetGptConfig({});

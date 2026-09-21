# AdPushup Prebid.js Custom Changes

## Scope

This document describes the changes in the AdPushup Prebid.js fork between:

- Base: `prebid/Prebid.js` `9.41.0`
- Head: `adpushup/Prebid.js` `adpushup.js/v9.41.0-custom-changes`
- Compare: <https://github.com/prebid/Prebid.js/compare/9.41.0...adpushup:Prebid.js:adpushup.js/v9.41.0-custom-changes>

The fork contains 29 changed files. The changes are grouped below by behavior rather than by merge commit. Adapter-specific documentation already present in the fork remains the authoritative source for detailed bidder examples.

## Executive Summary

The custom fork adds five bidder integrations and one bidder alias, modernizes several existing adapters, and adds AdPushup-specific runtime behavior:

- Adds Microsoft (`msft`), Floxis (`floxis`), Omnidex (`omnidex`), LoopMe (`loopme`), and Pinelake (`pinelake`) adapters.
- Adds `iqm` as an alias for the Pinelake adapter and `gourmetads` as an alias for the Microsoft adapter.
- Adds a shared request/response utility expansion used by Vidazoo-family adapters, including ProgrammaticX and Omnidex.
- Reworks Bidmatic request mapping, response parsing, user sync handling, and placement telemetry.
- Adds media-type and request-routing fixes for ePlanning, Index Exchange, Lucead, OMS, Relevate Health, Rubicon, Sharethrough, and SSP Geniee.
- Renames the generated global Prebid object from `pbjs` to `_apPbJs`.
- Adds a defensive Microsoft creative-rendering initialization and a type guard for non-string creatives.
- Adds an extensive Floxis unit-test suite covering request building, privacy, identity, syncs, billing, and telemetry.

## New Bidder Adapters

### Microsoft (`msft`)

Files: `modules/msftBidAdapter.js`, `modules/msftBidAdapter.md`

The Microsoft adapter is an OpenRTB-based replacement/integration for AppNexus demand. It supports banner, video, and native media types and uses GVL ID 32.

#### Request behavior

- Accepts either `placement_id`, or `member` together with `inv_code`.
- Converts legacy AppNexus-style parameters into OpenRTB fields under `imp.ext.appnexus`, `imp.tagid`, `imp.id`, `publisher`, `site`/`app`, `user`, and `regs`.
- Maps banner frameworks from `params.banner_frameworks` to `imp.banner.api`.
- Maps video configuration from `mediaTypes.video` and its `api` field.
- Passes through floors, GPID, supply chain, EIDs, DSA, COPPA, GDPR, USP, and relevant first-party data.
- Adds Microsoft/Prebid metadata, referrer-detection data, and OMID metadata when applicable.
- Supports debug configuration from the `apn_prebid_debug` cookie or query parameters such as `apn_debug_enabled` and `apn_debug_member_id`.
- Uses the normal endpoint when Purpose 1 consent is available and the simple endpoint otherwise.

#### Response and rendering behavior

- Converts OpenRTB responses back into Prebid bids.
- Supports instream video and native responses.
- Creates an outstream renderer when the response includes renderer URL and ID data.
- Hides conflicting Google DFP or Smart AdServer containers before rendering outstream video.
- Supports iframe syncing when enabled and GDPR Purpose 1 is available, with a pixel-sync fallback.

#### Migration notes

The Microsoft adapter uses the following important parameter changes from AppNexus:

| Previous AppNexus usage   | Microsoft usage                |
| ------------------------- | ------------------------------ |
| `placementId`             | `placement_id`                 |
| `publisher_id`            | `ortb2.site.publisher.id`      |
| `frameworks`              | `banner_frameworks`            |
| `params.user`             | `ortb2.user`                   |
| `params.video`            | `mediaTypes.video`             |
| `params.video.frameworks` | `mediaTypes.video.api`         |
| `reserve`                 | Floors module / `imp.bidfloor` |
| `position`                | `mediaTypes.banner.pos`        |
| `pub_click`               | `pubclick`                     |
| `external_imp_id`         | `ext_imp_id`                   |

Native requests must use the OpenRTB Native format. The legacy Prebid Native configuration is not supported by this adapter.

The alias `gourmetads` is registered on the Microsoft adapter and inherits GVL ID 32.

### Floxis (`floxis`)

Files: `modules/floxisBidAdapter.js`, `modules/floxisBidAdapter.md`, `libraries/floxisUtils/politePixel.js`, `test/spec/modules/floxisBidAdapter_spec.js`

The Floxis adapter supports banner, video, and native media types using OpenRTB. It uses GVL ID 1609 and defaults to the `us-e` region and `floxis` partner.

#### Request routing and validation

- Requires a non-empty string `params.seat`.
- Builds bidding hosts as `[partner-]region.floxis.tech`.
- Defaults to `https://us-e.floxis.tech/pbjs?seat=<seat>`.
- Groups bids by seat, region, and partner so each group is sent to the correct host.
- Validates region and partner as DNS labels before interpolating them into a request host.
- Sends POST requests with credentials and `contentType: text/plain`.

#### Privacy, floors, and identity

- Forwards GDPR, USP, GPP, COPPA, EIDs, supply chain, FPD, and other OpenRTB data.
- Uses the Floors module when available.
- Falls back to `params.bidFloor` and `params.bidFloorCur` when the Floors module is unavailable.
- Optionally creates a first-party UUID in `user.ext.floxisId`.
- Persists that UUID through Prebid storage APIs only when storage is permitted; otherwise it is omitted without failing the auction.
- The first-party UUID is a fallback and does not replace Floxis's primary server-side identity.

#### User sync and telemetry

- Reads `x-floxis-sync` response headers to derive seat and region sync targets.
- Uses iframe sync when enabled, otherwise image sync.
- Includes consent parameters in sync URLs and deduplicates identical seat/region syncs.
- Fires billing notices from `burl`, substituting the original CPM into `${AUCTION_PRICE}`.
- Reports timeout and bidder-error telemetry through background, `keepalive` requests with credentials omitted.
- Telemetry is pinned to `px-us-e.floxis.tech`, deduplicated per seat/region, and excludes page query strings and user/device identifiers.

The test suite covers validation, host safety, ORTB request mapping, floors, identity storage failure modes, response media types, user sync, billing, timeout telemetry, bidder errors, consent forwarding, and bid metadata.

### Omnidex (`omnidex`)

Files: `modules/omnidexBidAdapter.js`, `modules/omnidexBidAdapter.md`

Omnidex is a Vidazoo-family adapter using the shared Vidazoo utilities. It supports banner and video, uses GVL ID 1463, and routes requests to `https://<subdomain>.omni-dex.io`.

- Requires the shared `cId` and `pId` parameters.
- Uses shared request construction, response interpretation, user sync, bid-won, and billable callbacks.
- Adds auction and transaction identifiers through `createUniqueRequestData`.
- Uses Omnidex-specific iframe and image sync endpoints.

### LoopMe (`loopme`)

Files: `modules/loopmeBidAdapter.js`, `modules/loopmeBidAdapter.md`

LoopMe supports banner, video, and native through OpenRTB and uses GVL ID 109.

- Requires `publisherId`; `bundleId` and `placementId` are optional.
- Sends requests to `https://prebid.loopmertb.com/`.
- Adds bidder parameters under `imp.ext.bidder`.
- Forces OpenRTB auction type `at = 1`.
- Accepts server-provided image and iframe sync URLs only when the URL scheme is HTTP(S) or protocol-relative and the corresponding sync type is enabled.

### Pinelake and IQM (`pinelake`, alias `iqm`)

Files: `modules/pinelakeBidAdapter.js`, `modules/pinelakeBidAdapter.md`

Pinelake supports banner and native and uses the endpoint `https://rtb.pinelake.media/hb`.

- Requires `params.placement_id`.
- Uses shared AUD request and response helpers.
- Selects banner or native response handling based on the media type encoded in the request.
- The `iqm` alias points to the same adapter implementation.

## Shared Vidazoo Utility Changes

Files: `libraries/vidazooUtils/bidderUtils.js`, `libraries/vidazooUtils/constants.js`, `libraries/vidazooUtils/vidazooTypes.ts`

The shared utility layer was expanded to support the newer ProgrammaticX and Omnidex integrations.

### Request payload improvements

`buildRequestData` now forwards or derives:

- Page URL and query string, referrer, screen resolution, ad unit and bid identifiers.
- Publisher ID, GPID, transaction ID, media types, sizes, floors, and supply chain.
- Site categories, page categories, content data, content language, user data, device data, and user-agent hints.
- GDPR, US Privacy, GPP, COPPA, DSA, OMID, and storage-permission state.
- ORTB2 and ORTB2 impression objects.
- Adapter-specific `ext.*` values and placement ID.
- User IDs from both legacy `userId` values and modern `eids`.

Invalid device types are removed before sending the payload. Screen dimensions are obtained through the Prebid window-dimension helper instead of reading global `screen` directly.

### Request and response behavior

- Adds `onBidBillable` alongside the existing `onBidWon` callback.
- Adds `burl` handling during response interpretation.
- Restricts single-request mode to the configured multi-request adapter list.
- Supports optional host routing through `params.host` after basic host validation.
- Makes single-request chunk size configurable and caps it at 20 bids.
- Adds default iframe and image sync endpoints and can derive sync endpoints from the `x-us-base-url` response header.

The TypeScript definitions document common `pId`, `cId`, `bidFloor`, `placementId`, `subDomain`, and extension parameters.

## Existing Adapter Changes

### Bidmatic

File: `modules/bidmaticBidAdapter.js`

The adapter was rewritten from the previous ORTB flow to Bidmatic's `/bdm/auction` request format.

- Requires numeric `params.source` and optionally accepts numeric `params.bidfloor`.
- Builds a publisher-level tag containing domain, page environment, consent, COPPA, GPP, age verification, supply chain, user IDs, and timeout data.
- Adds placement ID, media type, sizes, floor, GPID, auction count, and distance-to-view to each bid request.
- Chunks requests according to the bidder configuration, with a default chunk size of 5.
- Matches response bids back to the originating bid ID before creating Prebid responses.
- Supports both banner and video response formats, including VAST and ad URLs.
- Extracts response-provided image and iframe sync URLs and deduplicates them.
- Adds page height, tab visibility, time-from-navigation, and placement viewability data.

### ePlanning

File: `modules/eplanningBidAdapter.js`

- Separates video and banner bids into independent requests.
- Uses a shared request builder with video disabled for banner requests.
- Restores response interpretation and user-sync handling in the adapter specification.
- Maps video ads to `vastXml` and video media type; maps banner ads to `ad`.
- Supports image and iframe sync entries returned in the response.

### Index Exchange

File: `modules/ixBidAdapter.js`

Adds an AdPushup-supported size allowlist. Banner and video impressions are emitted only for recognized sizes, and missing banner-size calculations are filtered through the same allowlist.

### Lucead

File: `modules/luceadBidAdapter.js`

When running inside AdPushup and the AdPushup utility API is available, the adapter injects `https://s.lucead.com/prebid/1138175580.js` into the page head. Injection errors are delegated to the AdPushup error handler.

### OMS

File: `modules/omsBidAdapter.js`

Adds processed banner formats and viewability data to `imp.banner`. Banner and video impressions are now assembled independently so banner metadata is not lost when video data is absent.

### Relevate Health

File: `modules/relevatehealthBidAdapter.js`

Replaces the custom request/response implementation with the shared AUD banner request and response helpers. Validation now requires only `placement_id`, while standard helper behavior handles request construction and bid formatting.

### Rubicon

File: `modules/rubiconBidAdapter.js`

- Forces multiformat routing for video and native requests through the PBS path.
- Treats qualifying video requests as multiformat regardless of the previous `bidonmultiformat` setting.
- Removes the mutation of `params.floor` while still validating the numeric floor value.

This changes request routing for mixed-format Rubicon units and should be considered when comparing auction traffic before and after the fork update.

### Sharethrough

File: `modules/sharethroughBidAdapter.js`

Outstream video request construction is temporarily disabled. The adapter now builds the banner impression path for supported requests, while the prior video construction remains commented in the source for later restoration.

### SSP Geniee

File: `modules/ssp_genieeBidAdapter.js`

Adds response-derived user syncing. The adapter extracts matching URLs embedded in the decoded ad markup and returns them as image or iframe syncs according to the enabled sync mode.

## Runtime and Build Changes

### Generated global name

File: `package.json`

The generated global variable changes from `pbjs` to `_apPbJs`:

```json
"globalVarName": "_apPbJs"
```

Consumers embedding this custom build must use `_apPbJs` for direct global access. This avoids collision with another Prebid.js instance on the page.

### Direct creative rendering guard

File: `src/adRendering.js`

Before writing a direct creative into the ad document, the renderer now checks that `adData.ad` is a string. If the creative contains `display-renderer/sdk.js` or `native-to-display/sdk.js`, it writes `window.MS_SDK_RENDER = null` before the creative markup. This prevents stale Microsoft SDK render state and avoids calling `.includes()` on non-string creative values.

## Complete Changed-File Inventory

| File                                         | Change category                                     |
| -------------------------------------------- | --------------------------------------------------- |
| `libraries/floxisUtils/politePixel.js`       | New background/cookieless telemetry helper          |
| `libraries/vidazooUtils/bidderUtils.js`      | Shared request, response, sync, and billing changes |
| `libraries/vidazooUtils/constants.js`        | Shared adapter constants and sync defaults          |
| `libraries/vidazooUtils/vidazooTypes.ts`     | Shared TypeScript bidder parameter types            |
| `modules/bidmaticBidAdapter.js`              | Request/response and placement telemetry rewrite    |
| `modules/eplanningBidAdapter.js`             | Media-type request split and sync handling          |
| `modules/floxisBidAdapter.js`                | New Floxis adapter                                  |
| `modules/floxisBidAdapter.md`                | Floxis adapter documentation                        |
| `modules/ixBidAdapter.js`                    | AdPushup size allowlist                             |
| `modules/loopmeBidAdapter.js`                | New LoopMe adapter                                  |
| `modules/loopmeBidAdapter.md`                | LoopMe adapter documentation                        |
| `modules/luceadBidAdapter.js`                | AdPushup Lucead script injection                    |
| `modules/msftBidAdapter.js`                  | New Microsoft adapter                               |
| `modules/msftBidAdapter.md`                  | Microsoft adapter documentation                     |
| `modules/nexx360BidAdapter.js`               | Adds `revnew` alias                                 |
| `modules/omnidexBidAdapter.js`               | New Omnidex adapter                                 |
| `modules/omnidexBidAdapter.md`               | Omnidex adapter documentation                       |
| `modules/omsBidAdapter.js`                   | Banner impression metadata fix                      |
| `modules/pinelakeBidAdapter.js`              | New Pinelake adapter and IQM alias                  |
| `modules/pinelakeBidAdapter.md`              | Pinelake adapter documentation                      |
| `modules/programmaticXBidAdapter.js`         | Shared Vidazoo utility integration and callbacks    |
| `modules/programmaticXBidAdapter.md`         | ProgrammaticX adapter documentation                 |
| `modules/relevatehealthBidAdapter.js`        | Shared AUD helper migration                         |
| `modules/rubiconBidAdapter.js`               | Forced multiformat routing and floor handling       |
| `modules/sharethroughBidAdapter.js`          | Temporary outstream disablement                     |
| `modules/ssp_genieeBidAdapter.js`            | Response-derived user sync                          |
| `package.json`                               | Global variable rename                              |
| `src/adRendering.js`                         | Microsoft SDK render guard                          |
| `test/spec/modules/floxisBidAdapter_spec.js` | Floxis unit tests                                   |

## Publisher Integration Checklist

Before shipping a build containing these changes:

1. Update any direct global references from `pbjs` to `_apPbJs`.
2. Confirm each new bidder is included in the build and that its required bidder parameters are configured.
3. For Microsoft, migrate legacy AppNexus parameters and convert native units to OpenRTB Native.
4. For Floxis, configure bidder storage permission only when the publisher has approved the identity behavior.
5. Review user-sync filter settings, especially iframe inclusion rules.
6. Validate Rubicon mixed-format routing and Sharethrough video behavior in the intended production configuration.
7. Run the adapter unit tests and a representative browser auction test before deployment.

## Verification Notes

The compare includes a dedicated Floxis test suite with broad behavioral coverage. This documentation change itself does not alter runtime code and does not require a build output refresh.

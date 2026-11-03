import { BANNER, NATIVE } from '../src/mediaTypes.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import {
  getBannerRequest,
  getBannerResponse,
  getNativeResponse
} from '../libraries/audUtils/bidderUtils.js';

const URL = 'https://rtb.pinelake.media/hb';
// Export const spec
export const spec = {
  code: 'pinelake',
  aliases: ['iqm'],
  supportedMediaTypes: [BANNER, NATIVE],
  // Determines whether given bid request is valid or not
  isBidRequestValid: (bidReq) => {
    return !!(bidReq && bidReq.params && bidReq.params.placement_id);
  },
  // Split banner and native so each HTTP request has one MediaType (official audUtils helper).
  buildRequests: (bidRequest, serverRequest) => {
    const bannerBids = [];
    const nativeBids = [];
    bidRequest.forEach((bid) => {
      if (bid.mediaTypes && bid.mediaTypes.native) {
        nativeBids.push(bid);
      } else {
        bannerBids.push(bid);
      }
    });
    const requests = [];
    if (bannerBids.length) {
      requests.push(getBannerRequest(bannerBids, serverRequest, URL));
    }
    if (nativeBids.length) {
      requests.push(getBannerRequest(nativeBids, serverRequest, URL));
    }
    return requests;
  },
  // Unpack the response from the server into a list of bids.
  interpretResponse: (bidResp, bidRq) => {
    let Response = {};
    const media = JSON.parse(bidRq.data)[0].MediaType;
    if (media === BANNER) {
      Response = getBannerResponse(bidResp, BANNER);
    } else if (media === NATIVE) {
      Response = getNativeResponse(bidResp, bidRq, NATIVE);
    }
    return Response;
  }
};

registerBidder(spec);

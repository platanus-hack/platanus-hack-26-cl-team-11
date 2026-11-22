import { secureHeaders } from 'hono/secure-headers';

const OWN_ORIGIN = "'self'";

export const securityHeaders = () =>
  secureHeaders({
    contentSecurityPolicy: { frameAncestors: [OWN_ORIGIN], baseUri: [OWN_ORIGIN], objectSrc: ["'none'"] },
    xFrameOptions: 'SAMEORIGIN',
    referrerPolicy: 'same-origin',
    crossOriginOpenerPolicy: 'same-origin-allow-popups',
    permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [], usb: [] },
  });

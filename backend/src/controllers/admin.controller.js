'use strict';

// Admin endpoints are deliberately fail-closed until their individual
// authorization, audit, and data-retention behavior has been implemented.
const unsupported = name => (req, res) => res.status(501).json({
  success: false,
  code: 'ADMIN_ENDPOINT_NOT_IMPLEMENTED',
  message: 'This administrative operation is not available in this build.',
  endpoint: name
});
module.exports = new Proxy({}, {
  get(_target, property) {
    return typeof property === 'string' ? unsupported(property) : undefined;
  }
});

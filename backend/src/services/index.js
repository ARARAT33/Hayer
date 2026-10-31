'use strict';

// Export only modules that exist in this server build. Optional subsystems must
// not be advertised as available merely because routes were sketched for them.
module.exports = {
  auth: require('./auth.service'),
  community: require('./community.service'),
  hayerId: require('./hayerId.service'),
  node: require('./node.service'),
  notification: require('./notification.service'),
  operator: require('./operator.service'),
  profile: require('./profile.service'),
  service: require('./service.service'),
  storage: require('./storage.service'),
  publicRegistry: require('./publicRegistry.service')
};

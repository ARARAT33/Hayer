// Export all controllers
module.exports = {
  auth: require('./auth.controller'),
  user: require('./user.controller'),
  hayerId: require('./hayerId.controller'),
  profile: require('./profile.controller'),
  node: require('./node.controller'),
  operator: require('./operator.controller'),
  storage: require('./storage.controller'),
  service: require('./service.controller'),
  community: require('./community.controller'),
  notification: require('./notification.controller'),
  admin: require('./admin.controller'),
  health: require('./health.controller'),
  registry: require('./registry.controller')
};

const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');
const fs = require('fs');

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  username: config.db.user,
  password: config.db.password,
  logging: config.env === 'development' ? console.log : false,
  pool: config.db.pool,
  ssl: config.db.ssl,
  dialectOptions: {
    ssl: config.db.ssl ? {
      require: true,
      rejectUnauthorized: false
    } : undefined
  },
  models: [path.join(__dirname, '*.model.js')]
});

// Test database connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
})();

// Import all models
const User = require('./user.model.js')(sequelize, DataTypes);
const Credential = require('./credential.model.js')(sequelize, DataTypes);
const Session = require('./session.model.js')(sequelize, DataTypes);
const HayerId = require('./hayerId.model.js')(sequelize, DataTypes);
const Profile = require('./profile.model.js')(sequelize, DataTypes);
const Role = require('./role.model.js')(sequelize, DataTypes);
const Permission = require('./permission.model.js')(sequelize, DataTypes);
const UserRole = require('./userRole.model.js')(sequelize, DataTypes);
const Service = require('./service.model.js')(sequelize, DataTypes);
const ServiceInstance = require('./serviceInstance.model.js')(sequelize, DataTypes);
const Node = require('./node.model.js')(sequelize, DataTypes);
const Operator = require('./operator.model.js')(sequelize, DataTypes);
const StorageObject = require('./storageObject.model.js')(sequelize, DataTypes);
const StorageChunk = require('./storageChunk.model.js')(sequelize, DataTypes);
const Replica = require('./replica.model.js')(sequelize, DataTypes);
const Notification = require('./notification.model.js')(sequelize, DataTypes);
const Community = require('./community.model.js')(sequelize, DataTypes);
const AuditEvent = require('./auditEvent.model.js')(sequelize, DataTypes);
const OAuthToken = require('./oauthToken.model.js')(sequelize, DataTypes);
const Passkey = require('./passkey.model.js')(sequelize, DataTypes);
const TOTP = require('./totp.model.js')(sequelize, DataTypes);

// Define model relationships
const defineRelationships = () => {
  // User relationships
  User.hasOne(HayerId, { foreignKey: 'userId', onDelete: 'CASCADE' });
  HayerId.belongsTo(User, { foreignKey: 'userId' });

  User.hasOne(Profile, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Profile.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(Credential, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Credential.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(Session, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Session.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(Passkey, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Passkey.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(TOTP, { foreignKey: 'userId', onDelete: 'CASCADE' });
  TOTP.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(OAuthToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
  OAuthToken.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Notification.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(AuditEvent, { foreignKey: 'userId', onDelete: 'SET NULL' });
  AuditEvent.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(StorageObject, { foreignKey: 'ownerId', onDelete: 'CASCADE' });
  StorageObject.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  // Role and Permission relationships
  User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId' });
  Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId' });

  Role.hasMany(Permission, { foreignKey: 'roleId', onDelete: 'CASCADE' });
  Permission.belongsTo(Role, { foreignKey: 'roleId' });

  // Service relationships
  Service.hasMany(ServiceInstance, { foreignKey: 'serviceId', onDelete: 'CASCADE' });
  ServiceInstance.belongsTo(Service, { foreignKey: 'serviceId' });

  User.hasMany(ServiceInstance, { foreignKey: 'createdBy', onDelete: 'SET NULL' });
  ServiceInstance.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

  // Node relationships
  Operator.hasMany(Node, { foreignKey: 'operatorId', onDelete: 'CASCADE' });
  Node.belongsTo(Operator, { foreignKey: 'operatorId' });

  User.hasMany(Node, { foreignKey: 'createdBy', onDelete: 'SET NULL' });
  Node.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

  // Storage relationships
  StorageObject.hasMany(StorageChunk, { foreignKey: 'objectId', onDelete: 'CASCADE' });
  StorageChunk.belongsTo(StorageObject, { foreignKey: 'objectId' });

  StorageChunk.hasMany(Replica, { foreignKey: 'chunkId', onDelete: 'CASCADE' });
  Replica.belongsTo(StorageChunk, { foreignKey: 'chunkId' });

  Node.hasMany(Replica, { foreignKey: 'nodeId', onDelete: 'CASCADE' });
  Replica.belongsTo(Node, { foreignKey: 'nodeId' });

  // Community relationships
  User.hasMany(Community, { foreignKey: 'createdBy', onDelete: 'SET NULL' });
  Community.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

  User.belongsToMany(Community, { through: 'CommunityMembers', foreignKey: 'userId' });
  Community.belongsToMany(User, { through: 'CommunityMembers', foreignKey: 'communityId' });

  // OAuth relationships
  ServiceInstance.hasMany(OAuthToken, { foreignKey: 'serviceInstanceId', onDelete: 'CASCADE' });
  OAuthToken.belongsTo(ServiceInstance, { foreignKey: 'serviceInstanceId' });

  // Node service relationships
  Node.belongsToMany(ServiceInstance, { through: 'NodeServices', foreignKey: 'nodeId' });
  ServiceInstance.belongsToMany(Node, { through: 'NodeServices', foreignKey: 'serviceInstanceId' });
};

// Initialize relationships
defineRelationships();

// Sync models with database (use with caution in production)
const sync = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('Database models synchronized.');
  } catch (error) {
    console.error('Error synchronizing models:', error);
    throw error;
  }
};

// Close connection
const close = async () => {
  await sequelize.close();
};

module.exports = {
  sequelize,
  Sequelize,
  DataTypes,
  User,
  Credential,
  Session,
  HayerId,
  Profile,
  Role,
  Permission,
  UserRole,
  Service,
  ServiceInstance,
  Node,
  Operator,
  StorageObject,
  StorageChunk,
  Replica,
  Notification,
  Community,
  AuditEvent,
  OAuthToken,
  Passkey,
  TOTP,
  sync,
  close
};

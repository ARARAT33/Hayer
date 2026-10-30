/**
 * Database Seeder
 * Populates the database with initial data for HAYER ecosystem
 */

const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Import models
const models = require('../models');

// Seed data
const seedData = {
  roles: [
    { id: uuidv4(), name: 'super_admin', description: 'Full system access', is_system: true },
    { id: uuidv4(), name: 'admin', description: 'Administrative access', is_system: true },
    { id: uuidv4(), name: 'moderator', description: 'Moderation capabilities', is_system: true },
    { id: uuidv4(), name: 'node_operator', description: 'Node management', is_system: true },
    { id: uuidv4(), name: 'user', description: 'Regular user', is_system: true },
    { id: uuidv4(), name: 'guest', description: 'Limited access', is_system: true }
  ],
  
  permissions: [
    // Super Admin permissions
    { role_id: null, resource: '*', action: '*', scope: 'all' },
    
    // Admin permissions
    { role_id: null, resource: 'user', action: 'manage', scope: 'all' },
    { role_id: null, resource: 'node', action: 'manage', scope: 'all' },
    { role_id: null, resource: 'operator', action: 'manage', scope: 'all' },
    { role_id: null, resource: 'service', action: 'manage', scope: 'all' },
    { role_id: null, resource: 'community', action: 'manage', scope: 'all' },
    { role_id: null, resource: 'storage', action: 'manage', scope: 'all' },
    { role_id: null, resource: 'audit', action: 'view', scope: 'all' },
    
    // Moderator permissions
    { role_id: null, resource: 'community', action: 'moderate', scope: 'all' },
    { role_id: null, resource: 'user', action: 'moderate', scope: 'all' },
    
    // Node Operator permissions
    { role_id: null, resource: 'node', action: 'manage', scope: 'own' },
    { role_id: null, resource: 'storage', action: 'manage', scope: 'own' },
    
    // User permissions
    { role_id: null, resource: 'profile', action: 'manage', scope: 'own' },
    { role_id: null, resource: 'storage', action: 'manage', scope: 'own' },
    { role_id: null, resource: 'community', action: 'create', scope: 'all' },
    { role_id: null, resource: 'community', action: 'participate', scope: 'all' }
  ],
  
  services: [
    { name: 'Mastodon', type: 'social', description: 'Federated social network', icon: 'mastodon', color: '#3088D4' },
    { name: 'Matrix', type: 'messenger', description: 'Decentralized messaging', icon: 'matrix', color: '#0DBD8B' },
    { name: 'Lemmy', type: 'forum', description: 'Federated forums', icon: 'lemmy', color: '#FF5722' },
    { name: 'PeerTube', type: 'video', description: 'Decentralized video hosting', icon: 'peertube', color: '#F44336' },
    { name: 'Pixelfed', type: 'photo', description: 'Federated image sharing', icon: 'pixelfed', color: '#DB7093' },
    { name: 'Nextcloud', type: 'storage', description: 'File storage and sync', icon: 'nextcloud', color: '#0082C9' },
    { name: 'Discourse', type: 'forum', description: 'Community discussion', icon: 'discourse', color: '#000000' },
    { name: 'Mobilizon', type: 'events', description: 'Event organization', icon: 'mobilizon', color: '#FF5722' },
    { name: 'Zulip', type: 'messenger', description: 'Team chat', icon: 'zulip', color: '#4D76FF' },
    { name: 'XMPP', type: 'messenger', description: 'Jabber messaging', icon: 'xmpp', color: '#4A90E2' }
  ],
  
  defaultUser: {
    email: 'admin@hayer.am',
    username: 'admin',
    display_name: 'HAYER Administrator',
    password: 'admin123',
    is_verified: true
  }
};

const seed = async () => {
  console.log('Starting database seeding...');
  
  try {
    // Create roles
    console.log('Seeding roles...');
    for (const role of seedData.roles) {
      await models.Role.create(role);
    }
    
    // Get created roles
    const roles = await models.Role.findAll();
    const roleMap = {};
    roles.forEach(r => roleMap[r.name] = r.id);
    
    // Create permissions with correct role IDs
    console.log('Seeding permissions...');
    for (const perm of seedData.permissions) {
      let roleId = null;
      if (perm.role_id === null) {
        // Assign to appropriate role
        if (perm.resource === '*' && perm.action === '*') {
          roleId = roleMap['super_admin'];
        } else if (['user', 'node', 'operator', 'service', 'community', 'storage', 'audit'].includes(perm.resource)) {
          roleId = roleMap['admin'];
        } else if (['community'].includes(perm.resource) && perm.action === 'moderate') {
          roleId = roleMap['moderator'];
        } else if (perm.resource === 'node' && perm.action === 'manage' && perm.scope === 'own') {
          roleId = roleMap['node_operator'];
        } else {
          roleId = roleMap['user'];
        }
      }
      
      await models.Permission.create({
        ...perm,
        role_id: roleId
      });
    }
    
    // Create services
    console.log('Seeding services...');
    for (const service of seedData.services) {
      await models.Service.create(service);
    }
    
    // Create default user
    console.log('Seeding default user...');
    const hashedPassword = await bcrypt.hash(seedData.defaultUser.password, 12);
    
    const user = await models.User.create({
      id: uuidv4(),
      email: seedData.defaultUser.email,
      username: seedData.defaultUser.username,
      display_name: seedData.defaultUser.display_name,
      password_hash: hashedPassword,
      is_verified: seedData.defaultUser.is_verified,
      language: 'hy'
    });
    
    // Create HAYER ID for default user
    const hayerId = await models.HayerId.create({
      userId: user.id,
      hayerId: 'HAYER-ADMIN-001',
      isPrimary: true,
      isActive: true
    });
    
    // Create profile for default user
    await models.Profile.create({
      userId: user.id,
      bio: 'HAYER System Administrator',
      privacySettings: {
        profileVisibility: 'public',
        emailVisibility: 'private',
        searchable: true
      },
      preferences: {
        theme: 'dark',
        notifications: {
          email: true,
          push: true
        }
      }
    });
    
    // Assign super_admin role to default user
    await models.UserRoles.create({
      userId: user.id,
      roleId: roleMap['super_admin'],
      assignedBy: user.id
    });
    
    console.log('\nSeeding completed successfully!');
    console.log(`\nDefault admin credentials:`);
    console.log(`  Email: ${seedData.defaultUser.email}`);
    console.log(`  Username: ${seedData.defaultUser.username}`);
    console.log(`  Password: ${seedData.defaultUser.password}`);
    console.log(`  HAYER ID: ${hayerId.hayerId}`);
    
    return {
      user: seedData.defaultUser,
      hayerId: hayerId.hayerId,
      roles: seedData.roles.length,
      permissions: seedData.permissions.length,
      services: seedData.services.length
    };
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeder
(async () => {
  try {
    await models.sequelize.authenticate();
    console.log('Database connection established.');
    await seed();
    process.exit(0);
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
})();

module.exports = { seed };

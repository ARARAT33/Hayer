/**
 * Migration 001: Create all HAYER database tables
 * This is the initial schema migration for the complete HAYER ecosystem
 */

module.exports = {
  up: async (context, DataTypes) => {
    const { sequelize } = context;
    
    // Create Users table
    await sequelize.getQueryInterface().createTable('users', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      display_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      language: {
        type: DataTypes.STRING(10),
        defaultValue: 'hy'
      },
      timezone: {
        type: DataTypes.STRING(50),
        defaultValue: 'Asia/Yerevan'
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      verification_token: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      verification_token_expires: {
        type: DataTypes.DATE,
        allowNull: true
      },
      password_reset_token: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      password_reset_token_expires: {
        type: DataTypes.DATE,
        allowNull: true
      },
      is_locked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      lock_reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      locked_until: {
        type: DataTypes.DATE,
        allowNull: true
      },
      failed_login_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      last_login_ip: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // Create HAYER IDs table
    await sequelize.getQueryInterface().createTable('hayer_ids', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      hayer_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Profiles table
    await sequelize.getQueryInterface().createTable('profiles', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      banner_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      website: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      location: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      birth_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      gender: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      social_links: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      privacy_settings: {
        type: DataTypes.JSONB,
        defaultValue: {
          profile_visibility: 'public',
          email_visibility: 'private',
          searchable: true
        }
      },
      preferences: {
        type: DataTypes.JSONB,
        defaultValue: {
          theme: 'system',
          notifications: {
            email: true,
            push: true
          }
        }
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Credentials table
    await sequelize.getQueryInterface().createTable('credentials', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'password, oauth, passkey, etc.'
      },
      provider: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'For OAuth: google, github, etc.'
      },
      provider_user_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      access_token: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      token_expires: {
        type: DataTypes.DATE,
        allowNull: true
      },
      scopes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Sessions table
    await sequelize.getQueryInterface().createTable('sessions', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      token: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      device_info: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Roles table
    await sequelize.getQueryInterface().createTable('roles', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      is_system: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Permissions table
    await sequelize.getQueryInterface().createTable('permissions', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      resource: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      action: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      scope: {
        type: DataTypes.STRING(50),
        defaultValue: 'all'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create UserRoles junction table
    await sequelize.getQueryInterface().createTable('user_roles', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      assigned_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Services table
    await sequelize.getQueryInterface().createTable('services', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'social, messenger, storage, forum, etc.'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      icon: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      color: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      is_system: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      config_schema: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create ServiceInstances table
    await sequelize.getQueryInterface().createTable('service_instances', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'services',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      url: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      api_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      configuration: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      credentials: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      health_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'unknown'
      },
      last_health_check: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Nodes table
    await sequelize.getQueryInterface().createTable('nodes', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      operator_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'operators',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      node_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      hostname: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      ip_addresses: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
      },
      public_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
      },
      capabilities: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        comment: 'storage, compute, proxy, etc.'
      },
      resources: {
        type: DataTypes.JSONB,
        defaultValue: {
          cpu: { total: 0, used: 0 },
          memory: { total: 0, used: 0 },
          storage: { total: 0, used: 0 },
          bandwidth: { total: 0, used: 0 }
        }
      },
      quota: {
        type: DataTypes.JSONB,
        defaultValue: {
          storage: null,
          bandwidth: null,
          connections: null
        }
      },
      location: {
        type: DataTypes.JSONB,
        defaultValue: {
          country: null,
          region: null,
          city: null,
          latitude: null,
          longitude: null
        }
      },
      failure_domain: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      is_approved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      last_heartbeat: {
        type: DataTypes.DATE,
        allowNull: true
      },
      last_health_check: {
        type: DataTypes.DATE,
        allowNull: true
      },
      health_score: {
        type: DataTypes.INTEGER,
        defaultValue: 100
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Operators table
    await sequelize.getQueryInterface().createTable('operators', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      operator_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      website: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      contact_email: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      public_key: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_trusted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      quota: {
        type: DataTypes.JSONB,
        defaultValue: {
          nodes: null,
          storage: null,
          bandwidth: null
        }
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create StorageObjects table
    await sequelize.getQueryInterface().createTable('storage_objects', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      object_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      type: {
        type: DataTypes.STRING(50),
        defaultValue: 'file'
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      size: {
        type: DataTypes.BIGINT,
        defaultValue: 0
      },
      chunk_size: {
        type: DataTypes.INTEGER,
        defaultValue: 4194304 // 4MB
      },
      encryption_key_id: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      encryption_algorithm: {
        type: DataTypes.STRING(50),
        defaultValue: 'AES-256-GCM'
      },
      hash_algorithm: {
        type: DataTypes.STRING(50),
        defaultValue: 'SHA-256'
      },
      root_hash: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_encrypted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      version: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'uploading'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create StorageChunks table
    await sequelize.getQueryInterface().createTable('storage_chunks', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      storage_object_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'storage_objects',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      chunk_index: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      chunk_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      data_hash: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      encrypted_data: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      encryption_nonce: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Replicas table
    await sequelize.getQueryInterface().createTable('replicas', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      storage_chunk_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'storage_chunks',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      node_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nodes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      replica_index: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
      },
      integrity_hash: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      integrity_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      last_verified: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create OAuthTokens table
    await sequelize.getQueryInterface().createTable('oauth_tokens', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      client_id: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      token: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      token_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'access_token'
      },
      scopes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      refresh_token_expires: {
        type: DataTypes.DATE,
        allowNull: true
      },
      is_revoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      revoked_reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Passkeys table
    await sequelize.getQueryInterface().createTable('passkeys', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      credential_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      public_key: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      counter: {
        type: DataTypes.BIGINT,
        defaultValue: 0
      },
      device_type: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      device_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      device_info: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      last_used: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create TOTP table
    await sequelize.getQueryInterface().createTable('totps', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      secret: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      issuer: {
        type: DataTypes.STRING(100),
        defaultValue: 'HAYER'
      },
      algorithm: {
        type: DataTypes.STRING(20),
        defaultValue: 'sha1'
      },
      digits: {
        type: DataTypes.INTEGER,
        defaultValue: 6
      },
      period: {
        type: DataTypes.INTEGER,
        defaultValue: 30
      },
      backup_codes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Notifications table
    await sequelize.getQueryInterface().createTable('notifications', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      data: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      priority: {
        type: DataTypes.STRING(20),
        defaultValue: 'normal'
      },
      related_entity_type: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      related_entity_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create Communities table
    await sequelize.getQueryInterface().createTable('communities', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      community_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      type: {
        type: DataTypes.STRING(50),
        defaultValue: 'public'
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      icon: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      banner: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      rules: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      settings: {
        type: DataTypes.JSONB,
        defaultValue: {
          allow_posts: true,
          allow_comments: true,
          moderation: 'pre'
        }
      },
      member_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      post_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create CommunityMembers junction table
    await sequelize.getQueryInterface().createTable('community_members', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      community_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'communities',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      role: {
        type: DataTypes.STRING(20),
        defaultValue: 'member'
      },
      joined_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create AuditEvents table
    await sequelize.getQueryInterface().createTable('audit_events', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      entity_type: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      entity_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      request_id: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      severity: {
        type: DataTypes.STRING(20),
        defaultValue: 'info'
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'success'
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      }
    });

    // Create indexes for better performance
    await sequelize.getQueryInterface().addIndex('users', ['email'], { unique: true });
    await sequelize.getQueryInterface().addIndex('users', ['username'], { unique: true });
    await sequelize.getQueryInterface().addIndex('users', ['is_verified']);
    await sequelize.getQueryInterface().addIndex('users', ['is_locked']);
    
    await sequelize.getQueryInterface().addIndex('hayer_ids', ['hayer_id'], { unique: true });
    await sequelize.getQueryInterface().addIndex('hayer_ids', ['user_id']);
    
    await sequelize.getQueryInterface().addIndex('sessions', ['user_id']);
    await sequelize.getQueryInterface().addIndex('sessions', ['token']);
    await sequelize.getQueryInterface().addIndex('sessions', ['is_active']);
    
    await sequelize.getQueryInterface().addIndex('nodes', ['operator_id']);
    await sequelize.getQueryInterface().addIndex('nodes', ['node_id'], { unique: true });
    await sequelize.getQueryInterface().addIndex('nodes', ['status']);
    await sequelize.getQueryInterface().addIndex('nodes', ['is_active']);
    await sequelize.getQueryInterface().addIndex('nodes', ['failure_domain']);
    
    await sequelize.getQueryInterface().addIndex('storage_objects', ['owner_id']);
    await sequelize.getQueryInterface().addIndex('storage_objects', ['object_id'], { unique: true });
    await sequelize.getQueryInterface().addIndex('storage_objects', ['status']);
    
    await sequelize.getQueryInterface().addIndex('storage_chunks', ['storage_object_id']);
    await sequelize.getQueryInterface().addIndex('storage_chunks', ['chunk_id'], { unique: true });
    
    await sequelize.getQueryInterface().addIndex('replicas', ['storage_chunk_id']);
    await sequelize.getQueryInterface().addIndex('replicas', ['node_id']);
    
    await sequelize.getQueryInterface().addIndex('communities', ['owner_id']);
    await sequelize.getQueryInterface().addIndex('communities', ['community_id'], { unique: true });
    
    await sequelize.getQueryInterface().addIndex('audit_events', ['user_id']);
    await sequelize.getQueryInterface().addIndex('audit_events', ['action']);
    await sequelize.getQueryInterface().addIndex('audit_events', ['entity_type']);
    await sequelize.getQueryInterface().addIndex('audit_events', ['created_at']);

    console.log('All tables created successfully');
  },

  down: async (context) => {
    const { sequelize } = context;
    
    // Drop all tables in reverse order
    const tables = [
      'audit_events',
      'community_members',
      'communities',
      'notifications',
      'totps',
      'passkeys',
      'oauth_tokens',
      'replicas',
      'storage_chunks',
      'storage_objects',
      'nodes',
      'operators',
      'service_instances',
      'services',
      'user_roles',
      'permissions',
      'roles',
      'sessions',
      'credentials',
      'profiles',
      'hayer_ids',
      'users'
    ];

    for (const table of tables) {
      await sequelize.getQueryInterface().dropTable(table);
    }

    console.log('All tables dropped successfully');
  }
};

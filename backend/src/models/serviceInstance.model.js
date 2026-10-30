module.exports = (sequelize, DataTypes) => {
  const ServiceInstance = sequelize.define('ServiceInstance', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    instanceId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'instance_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    serviceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'service_id',
      references: {
        model: 'services',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200]
      }
    },
    displayName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'display_name',
      validate: {
        len: [0, 200]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 500],
        isUrl: true
      }
    },
    apiUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'api_url',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    statusUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'status_url',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    webhookUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'webhook_url',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'active', 'inactive', 'suspended', 'banned', 'unreachable', 'maintenance']]
      }
    },
    health: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'unknown',
      validate: {
        isIn: [['healthy', 'degraded', 'unhealthy', 'unknown']]
      }
    },
    lastHealthCheckAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_health_check_at'
    },
    lastHealthCheckResult: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'last_health_check_result'
    },
    region: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: true,
      validate: {
        len: [0, 2],
        is: /^[A-Z]{2}$/i
      }
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    failureDomain: {
      type: DataTypes.STRING(180),
      allowNull: true,
      field: 'failure_domain',
      validate: {
        len: [0, 180]
      }
    },
    configuration: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidConfiguration(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Configuration must be an object');
          }
        }
      }
    },
    credentials: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      field: 'credentials',
      validate: {
        isValidCredentials(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Credentials must be an object');
          }
        }
      }
    },
    encryptedCredentials: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'encrypted_credentials'
    },
    integrationMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'federated_public',
      field: 'integration_mode',
      validate: {
        isIn: [['hayer_sso', 'oauth_consent', 'managed_provisioning', 'federated_public', 'storage_agent', 'unsupported']]
      }
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified'
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at'
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'verified_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    verificationToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'verification_token'
    },
    verificationTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verification_token_expires_at'
    },
    userCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'user_count',
      validate: {
        min: 0
      }
    },
    storageUsed: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: 0,
      field: 'storage_used',
      validate: {
        min: 0
      }
    },
    quota: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        storage: { limit: 0, used: 0 },
        users: { limit: 0, used: 0 },
        requests: { limit: 0, used: 0 }
      }
    },
    capabilities: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidCapabilities(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Capabilities must be an array');
          }
        }
      }
    },
    registration: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
      validate: {
        isIn: [['open', 'invite_only', 'closed', 'unknown', 'not_applicable']]
      }
    },
    policyUrls: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'policy_urls',
      validate: {
        isValidPolicyUrls(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Policy URLs must be an array');
          }
        }
      }
    },
    securityContact: {
      type: DataTypes.STRING(254),
      allowNull: true,
      field: 'security_contact',
      validate: {
        len: [0, 254],
        isEmail: true
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidMetadata(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Metadata must be an object');
          }
        }
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'service_instances',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['instance_id']
      },
      {
        fields: ['service_id']
      },
      {
        fields: ['created_by']
      },
      {
        fields: ['status']
      },
      {
        fields: ['health']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['integration_mode']
      },
      {
        fields: ['region']
      },
      {
        fields: ['country']
      },
      {
        fields: ['failure_domain']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return ServiceInstance;
};

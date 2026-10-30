module.exports = (sequelize, DataTypes) => {
  const Node = sequelize.define('Node', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    nodeId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'node_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    operatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'operator_id',
      references: {
        model: 'operators',
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
    statusUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'status_url',
      validate: {
        len: [0, 500],
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
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'public_key',
      validate: {
        len: [0, 5000]
      }
    },
    publicKeyFingerprint: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'public_key_fingerprint',
      validate: {
        len: [0, 255]
      }
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'storage',
      validate: {
        isIn: [['storage', 'compute', 'gateway', 'proxy', 'cache', 'indexer', 'validator']]
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'active', 'paused', 'maintenance', 'quarantined', 'revoked', 'failed', 'unreachable']]
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
          const validCapabilities = [
            'public_read',
            'publish',
            'messaging',
            'media_upload',
            'file_storage',
            'encrypted_chunk_storage',
            'account_provisioning',
            'oidc',
            'federation',
            'backup_export',
            'compute',
            'indexing',
            'caching',
            'proxying',
            'monitoring'
          ];
          const isValid = value.every(cap => validCapabilities.includes(cap));
          if (!isValid) {
            throw new Error('Invalid capability');
          }
        }
      }
    },
    resources: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        cpu: { cores: 0, usage: 0 },
        memory: { total: 0, available: 0, usage: 0 },
        storage: { total: 0, available: 0, usage: 0 },
        bandwidth: { in: 0, out: 0 }
      },
      validate: {
        isValidResources(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Resources must be an object');
          }
        }
      }
    },
    maxStorage: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: 0,
      field: 'max_storage',
      validate: {
        min: 0
      }
    },
    usedStorage: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: 0,
      field: 'used_storage',
      validate: {
        min: 0
      }
    },
    quota: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        storage: { limit: 0, used: 0 },
        bandwidth: { limit: 0, used: 0 },
        requests: { limit: 0, used: 0 }
      }
    },
    integrationModes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'integration_modes',
      validate: {
        isValidIntegrationModes(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Integration modes must be an array');
          }
          const validModes = [
            'hayer_sso',
            'oauth_consent',
            'managed_provisioning',
            'federated_public',
            'storage_agent',
            'unsupported'
          ];
          const isValid = value.every(mode => validModes.includes(mode));
          if (!isValid) {
            throw new Error('Invalid integration mode');
          }
        }
      }
    },
    software: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    softwareVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'software_version',
      validate: {
        len: [0, 50]
      }
    },
    agentVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'agent_version',
      validate: {
        len: [0, 50]
      }
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_seen_at'
    },
    registeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'registered_at'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approved_at'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'approved_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at'
    },
    revokedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'revoked_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    revocationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'revocation_reason',
      validate: {
        len: [0, 5000]
      }
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
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
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
    }
  }, {
    tableName: 'nodes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['node_id']
      },
      {
        fields: ['operator_id']
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
        fields: ['type']
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
        fields: ['verified']
      },
      {
        fields: ['registered_at']
      },
      {
        fields: ['last_seen_at']
      },
      {
        fields: ['last_health_check_at']
      }
    ]
  });

  return Node;
};

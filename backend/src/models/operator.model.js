module.exports = (sequelize, DataTypes) => {
  const Operator = sequelize.define('Operator', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    operatorId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'operator_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
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
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    email: {
      type: DataTypes.STRING(254),
      allowNull: true,
      validate: {
        len: [0, 254],
        isEmail: true
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
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'suspended', 'banned', 'pending', 'unverified']]
      }
    },
    tier: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'community',
      validate: {
        isIn: [['community', 'trusted', 'official', 'enterprise']]
      }
    },
    nodeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'node_count',
      validate: {
        min: 0,
        max: 1000
      }
    },
    maxNodes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 10,
      field: 'max_nodes',
      validate: {
        min: 1,
        max: 1000
      }
    },
    totalStorage: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: 0,
      field: 'total_storage',
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
        nodes: { limit: 10, used: 0 },
        storage: { limit: 0, used: 0 },
        bandwidth: { limit: 0, used: 0 }
      }
    },
    regions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidRegions(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Regions must be an array');
          }
        }
      }
    },
    registeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'registered_at'
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
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
    abuseContact: {
      type: DataTypes.STRING(254),
      allowNull: true,
      field: 'abuse_contact',
      validate: {
        len: [0, 254],
        isEmail: true
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
    tableName: 'operators',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['operator_id']
      },
      {
        unique: true,
        fields: ['user_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['tier']
      },
      {
        fields: ['verified']
      },
      {
        fields: ['registered_at']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Operator;
};

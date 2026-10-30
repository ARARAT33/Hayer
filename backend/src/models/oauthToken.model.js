module.exports = (sequelize, DataTypes) => {
  const OAuthToken = sequelize.define('OAuthToken', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
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
    serviceInstanceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'service_instance_id',
      references: {
        model: 'service_instances',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 500]
      }
    },
    tokenType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'bearer',
      field: 'token_type',
      validate: {
        isIn: [['bearer', 'mac', 'basic']]
      }
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'access_token',
      validate: {
        notEmpty: true
      }
    },
    encryptedAccessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'encrypted_access_token'
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token'
    },
    encryptedRefreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'encrypted_refresh_token'
    },
    tokenSecret: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'token_secret'
    },
    scope: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    provider: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    providerId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'provider_id',
      validate: {
        len: [0, 255]
      }
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    refreshExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refresh_expires_at'
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'issued_at'
    },
    authorizationCode: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'authorization_code',
      validate: {
        len: [0, 500]
      }
    },
    codeVerifier: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'code_verifier',
      validate: {
        len: [0, 255]
      }
    },
    state: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: [0, 255]
      }
    },
    redirectUri: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'redirect_uri',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_revoked'
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
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at'
    },
    usageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'usage_count',
      validate: {
        min: 0
      }
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
      validate: {
        len: [0, 45],
        isIP: true
      }
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
      validate: {
        len: [0, 1000]
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
    tableName: 'oauth_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['token']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['service_instance_id']
      },
      {
        fields: ['provider']
      },
      {
        fields: ['provider_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_revoked']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['last_used_at']
      }
    ]
  });

  return OAuthToken;
};

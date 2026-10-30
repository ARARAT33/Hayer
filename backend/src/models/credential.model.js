module.exports = (sequelize, DataTypes) => {
  const Credential = sequelize.define('Credential', {
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
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        isIn: [['password', 'oauth', 'passkey', 'mfa', 'recovery']]
      }
    },
    identifier: {
      type: DataTypes.STRING(254),
      allowNull: true,
      validate: {
        len: [0, 254]
      }
    },
    secret: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'secret',
      validate: {
        len: [0, 5000]
      }
    },
    encryptedSecret: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'encrypted_secret'
    },
    iv: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'iv'
    },
    algorithm: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'aes-256-gcm',
      validate: {
        isIn: [['aes-256-gcm', 'aes-256-cbc', 'rsa']]
      }
    },
    provider: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
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
    scope: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token'
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token'
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'token_expires_at'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default'
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at'
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
    tableName: 'credentials',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['type']
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
        fields: ['is_default']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Credential;
};

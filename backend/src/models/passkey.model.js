module.exports = (sequelize, DataTypes) => {
  const Passkey = sequelize.define('Passkey', {
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
    credentialId: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
      field: 'credential_id',
      validate: {
        notEmpty: true,
        len: [1, 500]
      }
    },
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'public_key',
      validate: {
        notEmpty: true
      }
    },
    credentialPublicKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'credential_public_key',
      validate: {
        notEmpty: true
      }
    },
    counter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    deviceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'unknown',
      field: 'device_type',
      validate: {
        isIn: [['platform', 'roaming', 'unknown']]
      }
    },
    deviceName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'device_name',
      validate: {
        len: [0, 255]
      }
    },
    deviceOs: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'device_os',
      validate: {
        len: [0, 50]
      }
    },
    deviceBrowser: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'device_browser',
      validate: {
        len: [0, 50]
      }
    },
    attestationType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'attestation_type',
      validate: {
        len: [0, 50]
      }
    },
    attestation: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    transports: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidTransports(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Transports must be an array');
          }
          const validTransports = ['usb', 'ble', 'nfc', 'internal', 'hybrid'];
          const isValid = value.every(transport => validTransports.includes(transport));
          if (!isValid) {
            throw new Error('Invalid transport type');
          }
        }
      }
    },
    flags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        userPresent: false,
        userVerified: false,
        backupEligible: false,
        backupState: false
      }
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
    tableName: 'passkeys',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['credential_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_default']
      },
      {
        fields: ['device_type']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['last_used_at']
      }
    ]
  });

  return Passkey;
};

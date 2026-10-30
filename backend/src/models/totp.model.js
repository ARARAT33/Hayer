module.exports = (sequelize, DataTypes) => {
  const TOTP = sequelize.define('TOTP', {
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
    secret: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
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
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'sha1',
      validate: {
        isIn: [['sha1', 'sha256', 'sha512']]
      }
    },
    digits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
      validate: {
        min: 6,
        max: 8
      }
    },
    period: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      validate: {
        min: 15,
        max: 120
      }
    },
    issuer: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'HAYER',
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    accountName: {
      type: DataTypes.STRING(254),
      allowNull: false,
      field: 'account_name',
      validate: {
        notEmpty: true,
        len: [1, 254]
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
    deviceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'device_type',
      validate: {
        len: [0, 50]
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
    backupCodes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'backup_codes',
      validate: {
        isValidBackupCodes(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Backup codes must be an array');
          }
          if (value.length > 10) {
            throw new Error('Maximum 10 backup codes allowed');
          }
        }
      }
    },
    backupCodesHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'backup_codes_hash',
      validate: {
        len: [0, 255]
      }
    },
    recoveryCodes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'recovery_codes',
      validate: {
        isValidRecoveryCodes(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Recovery codes must be an array');
          }
          if (value.length > 10) {
            throw new Error('Maximum 10 recovery codes allowed');
          }
        }
      }
    },
    recoveryCodesHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'recovery_codes_hash',
      validate: {
        len: [0, 255]
      }
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
    tableName: 'totps',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
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
        fields: ['algorithm']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['last_used_at']
      }
    ]
  });

  return TOTP;
};

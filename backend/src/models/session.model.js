module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
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
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [64, 500]
      }
    },
    refreshToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'refresh_token',
      validate: {
        len: [0, 500]
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
    deviceId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'device_id',
      validate: {
        len: [0, 255]
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
        len: [0, 50],
        isIn: [['desktop', 'mobile', 'tablet', 'tv', 'unknown']]
      }
    },
    os: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    osVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'os_version',
      validate: {
        len: [0, 50]
      }
    },
    browser: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    browserVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'browser_version',
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
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
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
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_activity_at'
    }
  }, {
    tableName: 'sessions',
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
        fields: ['device_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['last_activity_at']
      }
    ]
  });

  return Session;
};

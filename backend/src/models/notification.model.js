module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
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
        isIn: [['info', 'warning', 'error', 'success', 'message', 'request', 'alert', 'system']]
      }
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200]
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 5000]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 10000]
      }
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidData(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Data must be an object');
          }
        }
      }
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 10
      }
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_read'
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_archived'
    },
    isDismissible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_dismissible'
    },
    actionUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'action_url',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    actionLabel: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'action_label',
      validate: {
        len: [0, 100]
      }
    },
    icon: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [0, 20],
        is: /^#[0-9A-Fa-f]{3,8}$/i
      }
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    sourceId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'source_id',
      validate: {
        len: [0, 255]
      }
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at'
    },
    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'archived_at'
    },
    dismissedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'dismissed_at'
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
    tableName: 'notifications',
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
        fields: ['category']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['is_read']
      },
      {
        fields: ['is_archived']
      },
      {
        fields: ['source']
      },
      {
        fields: ['source_id']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Notification;
};

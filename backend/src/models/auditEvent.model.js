module.exports = (sequelize, DataTypes) => {
  const AuditEvent = sequelize.define('AuditEvent', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    eventId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'event_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        isIn: [['authentication', 'authorization', 'user_management', 'data', 'system', 'security', 'storage', 'network', 'service']]
      }
    },
    resource: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    resourceId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'resource_id',
      validate: {
        len: [0, 255]
      }
    },
    resourceType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'resource_type',
      validate: {
        len: [0, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidDetails(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Details must be an object');
          }
        }
      }
    },
    oldValue: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'old_value',
      validate: {
        isValidOldValue(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Old value must be an object');
          }
        }
      }
    },
    newValue: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'new_value',
      validate: {
        isValidNewValue(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('New value must be an object');
          }
        }
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'success',
      validate: {
        isIn: [['success', 'failure', 'pending', 'partial']]
      }
    },
    severity: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'info',
      validate: {
        isIn: [['debug', 'info', 'warning', 'error', 'critical']]
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
    sessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'session_id',
      references: {
        model: 'sessions',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    requestId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'request_id',
      validate: {
        len: [0, 255]
      }
    },
    correlationId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'correlation_id',
      validate: {
        len: [0, 255]
      }
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    sourceIp: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'source_ip',
      validate: {
        len: [0, 45],
        isIP: true
      }
    },
    errorCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'error_code',
      validate: {
        len: [0, 100]
      }
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
      validate: {
        len: [0, 5000]
      }
    },
    stackTrace: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'stack_trace',
      validate: {
        len: [0, 10000]
      }
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
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
    tableName: 'audit_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['event_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['action']
      },
      {
        fields: ['category']
      },
      {
        fields: ['resource']
      },
      {
        fields: ['resource_id']
      },
      {
        fields: ['resource_type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['severity']
      },
      {
        fields: ['ip_address']
      },
      {
        fields: ['session_id']
      },
      {
        fields: ['request_id']
      },
      {
        fields: ['correlation_id']
      },
      {
        fields: ['source']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['completed_at']
      }
    ]
  });

  return AuditEvent;
};

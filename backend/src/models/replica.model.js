module.exports = (sequelize, DataTypes) => {
  const Replica = sequelize.define('Replica', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    replicaId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'replica_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    chunkId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'chunk_id',
      references: {
        model: 'storage_chunks',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    nodeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'node_id',
      references: {
        model: 'nodes',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'uploading', 'uploaded', 'available', 'corrupted', 'missing', 'deleted', 'quarantined']]
      }
    },
    hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    hashAlgorithm: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'sha256',
      field: 'hash_algorithm',
      validate: {
        isIn: [['md5', 'sha1', 'sha256', 'sha384', 'sha512']]
      }
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    storagePath: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      field: 'storage_path',
      validate: {
        len: [0, 1000]
      }
    },
    storageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'storage_url',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    encryption: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        algorithm: 'aes-256-gcm',
        keyId: null,
        encrypted: true
      },
      validate: {
        isValidEncryption(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Encryption must be an object');
          }
        }
      }
    },
    integrityVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'integrity_verified'
    },
    integrityVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'integrity_verified_at'
    },
    lastIntegrityCheckAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_integrity_check_at'
    },
    lastIntegrityCheckResult: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'last_integrity_check_result'
    },
    uploadAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'upload_attempts',
      validate: {
        min: 0,
        max: 10
      }
    },
    lastUploadError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_upload_error',
      validate: {
        len: [0, 5000]
      }
    },
    repairAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'repair_attempts',
      validate: {
        min: 0,
        max: 5
      }
    },
    lastRepairError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_repair_error',
      validate: {
        len: [0, 5000]
      }
    },
    quarantineReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'quarantine_reason',
      validate: {
        len: [0, 5000]
      }
    },
    quarantinedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'quarantined_at'
    },
    quarantinedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'quarantined_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'uploaded_at'
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'uploaded_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    lastAccessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_accessed_at'
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
    region: {
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
    tableName: 'replicas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['replica_id']
      },
      {
        fields: ['chunk_id']
      },
      {
        unique: true,
        fields: ['chunk_id', 'node_id']
      },
      {
        fields: ['node_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['hash']
      },
      {
        fields: ['integrity_verified']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['region']
      },
      {
        fields: ['failure_domain']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Replica;
};

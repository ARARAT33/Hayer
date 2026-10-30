module.exports = (sequelize, DataTypes) => {
  const StorageObject = sequelize.define('StorageObject', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    objectId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'object_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'owner_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 500]
      }
    },
    originalName: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'original_name',
      validate: {
        len: [0, 500]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'file',
      validate: {
        isIn: [['file', 'image', 'video', 'audio', 'document', 'archive', 'other']]
      }
    },
    mimeType: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'mime_type',
      validate: {
        len: [0, 255]
      }
    },
    size: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    chunkSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4194304,
      field: 'chunk_size',
      validate: {
        min: 1024,
        max: 104857600
      }
    },
    chunkCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'chunk_count',
      validate: {
        min: 0
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
          if (!value.algorithm) {
            throw new Error('Encryption algorithm is required');
          }
        }
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
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'uploading',
      validate: {
        isIn: [['uploading', 'complete', 'available', 'degraded', 'corrupted', 'deleted', 'purged']]
      }
    },
    visibility: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'private',
      validate: {
        isIn: [['private', 'public', 'shared', 'internal']]
      }
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_public'
    },
    publicUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'public_url',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    accessControl: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      field: 'access_control',
      validate: {
        isValidAccessControl(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Access control must be an object');
          }
        }
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
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidTags(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Tags must be an array');
          }
        }
      }
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'parent_id',
      references: {
        model: 'storage_objects',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    path: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    versions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidVersions(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Versions must be an array');
          }
        }
      }
    },
    replicaCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'replica_count',
      validate: {
        min: 0
      }
    },
    minReplicas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      field: 'min_replicas',
      validate: {
        min: 1,
        max: 10
      }
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'uploaded_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    },
    lastAccessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_accessed_at'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    retentionPolicy: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        keepForever: true,
        autoDelete: false,
        deleteAfterDays: null
      },
      field: 'retention_policy'
    },
    storageClass: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'standard',
      field: 'storage_class',
      validate: {
        isIn: [['standard', 'archive', 'cold', 'hot']]
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
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    }
  }, {
    tableName: 'storage_objects',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['object_id']
      },
      {
        fields: ['owner_id']
      },
      {
        fields: ['parent_id']
      },
      {
        fields: ['name']
      },
      {
        fields: ['type']
      },
      {
        fields: ['hash']
      },
      {
        fields: ['status']
      },
      {
        fields: ['visibility']
      },
      {
        fields: ['is_public']
      },
      {
        fields: ['size']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['deleted_at']
      }
    ]
  });

  return StorageObject;
};

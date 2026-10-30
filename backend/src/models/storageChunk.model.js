module.exports = (sequelize, DataTypes) => {
  const StorageChunk = sequelize.define('StorageChunk', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    chunkId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'chunk_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    objectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'object_id',
      references: {
        model: 'storage_objects',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    data: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: 'data'
    },
    dataUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'data_url',
      validate: {
        len: [0, 500],
        isUrl: true
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
    encryption: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        algorithm: 'aes-256-gcm',
        keyId: null,
        iv: null,
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
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'uploading', 'uploaded', 'available', 'corrupted', 'missing', 'deleted']]
      }
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
        model: 'nodes',
        key: 'id'
      },
      onDelete: 'SET NULL'
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
    tableName: 'storage_chunks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['chunk_id']
      },
      {
        fields: ['object_id']
      },
      {
        fields: ['object_id', 'index']
      },
      {
        fields: ['hash']
      },
      {
        fields: ['status']
      },
      {
        fields: ['storage_class']
      },
      {
        fields: ['integrity_verified']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return StorageChunk;
};

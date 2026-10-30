module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 80],
        is: /^[a-zA-Z0-9_-]+$/i
      }
    },
    displayName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'display_name',
      validate: {
        len: [0, 200]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_system'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default'
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'permissions',
      validate: {
        isValidPermissions(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Permissions must be an array');
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
    tableName: 'roles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['name']
      },
      {
        fields: ['is_system']
      },
      {
        fields: ['is_default']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Role;
};

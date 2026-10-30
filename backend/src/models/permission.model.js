module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define('Permission', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'role_id',
      references: {
        model: 'roles',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 100],
        is: /^[a-zA-Z0-9_:.-]+$/i
      }
    },
    resource: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
        isIn: [['create', 'read', 'update', 'delete', 'list', 'manage', 'admin', '*']]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    isWildcard: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_wildcard'
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
    tableName: 'permissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        fields: ['role_id']
      },
      {
        fields: ['name']
      },
      {
        fields: ['resource']
      },
      {
        fields: ['action']
      },
      {
        unique: true,
        fields: ['role_id', 'name']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Permission;
};

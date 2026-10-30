module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define('UserRole', {
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
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'role_id',
      references: {
        model: 'Roles',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    assignedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assigned_by',
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'assigned_at'
    }
  }, {
    tableName: 'UserRoles',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'role_id'],
        name: 'UserRoles_user_role_unique'
      },
      {
        fields: ['user_id'],
        name: 'UserRoles_user_id_idx'
      },
      {
        fields: ['role_id'],
        name: 'UserRoles_role_id_idx'
      },
      {
        fields: ['assigned_by'],
        name: 'UserRoles_assigned_by_idx'
      }
    ]
  });

  UserRole.associate = (models) => {
    UserRole.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    UserRole.belongsTo(models.Role, { foreignKey: 'roleId', as: 'role' });
    UserRole.belongsTo(models.User, { foreignKey: 'assignedBy', as: 'assigner' });
  };

  return UserRole;
};

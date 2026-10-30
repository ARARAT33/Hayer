module.exports = (sequelize, DataTypes) => {
  const HayerId = sequelize.define('HayerId', {
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
    hayerId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'hayer_id',
      validate: {
        notEmpty: true,
        len: [8, 64],
        is: /^[a-zA-Z0-9_-]+$/i
      }
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_primary'
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
    tableName: 'hayer_ids',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['hayer_id']
      },
      {
        unique: true,
        fields: ['user_id']
      },
      {
        fields: ['is_primary']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return HayerId;
};

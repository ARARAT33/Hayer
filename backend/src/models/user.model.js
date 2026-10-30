module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    username: {
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
      validate: {
        len: [0, 200]
      }
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_hash'
    },
    passwordAlgorithm: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'argon2id',
      field: 'password_algorithm'
    },
    passwordIterations: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 12,
      field: 'password_iterations'
    },
    passwordSalt: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_salt'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified'
    },
    verificationToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'verification_token'
    },
    verificationTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verification_token_expires_at'
    },
    resetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'reset_token'
    },
    resetTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_token_expires_at'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    },
    loginCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'login_count'
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'failed_login_attempts'
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'locked_until'
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
    tableName: 'users',
    paranoid: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        unique: true,
        fields: ['username']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['deleted_at']
      }
    ]
  });

  return User;
};

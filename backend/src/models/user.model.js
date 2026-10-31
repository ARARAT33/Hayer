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
    },
    // Հասակ (տարիներ)
    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 13,
        max: 120
      }
    },
    // Ծննդյան ամսաթիվ
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'birth_date'
    },
    // 18+ ստուգում է կատարվել
    isAgeVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_age_verified'
    },
    // Հասակային ստուգման մեթոդ
    ageVerificationMethod: {
      type: DataTypes.ENUM('none', 'selfie', 'qr_code', 'document', 'manual'),
      allowNull: false,
      defaultValue: 'none',
      field: 'age_verification_method'
    },
    // 18+ ստուգման վիճակ
    ageVerificationStatus: {
      type: DataTypes.ENUM('not_required', 'pending', 'verified', 'rejected', 'expired'),
      allowNull: false,
      defaultValue: 'not_required',
      field: 'age_verification_status'
    },
    // Հասակային ստուգման սեսիայի ID
    ageVerificationSessionId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'age_verification_session_id'
    },
    // Սարքը ունի տեսախցիկ
    hasCamera: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'has_camera'
    },
    // Ներածական լեզու (hy, en, ru, etc.)
    language: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'hy',
      validate: {
        isIn: [['hy', 'en', 'ru', 'fr', 'de', 'es', 'it', 'ar']]
      }
    },
    // Նշաններ (JSON)
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    // Ակտիվ սեսիաներ
    activeSessions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'active_sessions'
    },
    // Վերջին ակտիվություն
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_activity_at'
    },
    // Ակաունթի տիպ ('personal', 'business', 'organization', 'government')
    accountType: {
      type: DataTypes.ENUM('personal', 'business', 'organization', 'government'),
      allowNull: false,
      defaultValue: 'personal',
      field: 'account_type'
    },
    // Գնալոգիական ինֆորմացիա
    profileCompleteness: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      },
      field: 'profile_completeness'
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
        fields: ['is_age_verified']
      },
      {
        fields: ['age']
      },
      {
        fields: ['age_verification_status']
      },
      {
        fields: ['language']
      },
      {
        fields: ['account_type']
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

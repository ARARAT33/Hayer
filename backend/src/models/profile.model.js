module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define('Profile', {
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
    firstName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'first_name',
      validate: {
        len: [0, 200]
      }
    },
    lastName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'last_name',
      validate: {
        len: [0, 200]
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
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 5000]
      }
    },
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    banner: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: [0, 200]
      }
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'birth_date'
    },
    gender: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    language: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'hy',
      validate: {
        len: [0, 10]
      }
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'Asia/Yerevan',
      validate: {
        len: [0, 50]
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'phone',
      validate: {
        len: [0, 20],
        is: /^[\d\s\-\+\(\)]+$/i
      }
    },
    socialLinks: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      field: 'social_links',
      validate: {
        isValidSocialLinks(value) {
          if (!value) return true;
          const allowedPlatforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'github', 'gitlab', 'matrix', 'mastodon', 'telegram', 'signal', 'discord'];
          const keys = Object.keys(value);
          const isValid = keys.every(key => allowedPlatforms.includes(key));
          if (!isValid) {
            throw new Error('Invalid social platform');
          }
        }
      }
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      field: 'preferences',
      validate: {
        isValidPreferences(value) {
          if (!value) return true;
          // Validate preferences structure
          const validKeys = ['theme', 'notifications', 'privacy', 'language', 'timezone'];
          const keys = Object.keys(value);
          const isValid = keys.every(key => validKeys.includes(key));
          if (!isValid) {
            throw new Error('Invalid preference key');
          }
        }
      }
    },
    privacySettings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        profileVisibility: 'public',
        showEmail: false,
        showPhone: false,
        showBirthDate: false,
        showLocation: true,
        searchable: true,
        allowMessages: true,
        allowFollows: true
      },
      field: 'privacy_settings'
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
    tableName: 'profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      },
      {
        fields: ['display_name']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Profile;
};

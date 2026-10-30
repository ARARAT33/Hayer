module.exports = (sequelize, DataTypes) => {
  const Community = sequelize.define('Community', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    communityId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'community_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200]
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
        len: [0, 10000]
      }
    },
    shortDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'short_description',
      validate: {
        len: [0, 500]
      }
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'public',
      validate: {
        isIn: [['public', 'private', 'invite_only', 'restricted']]
      }
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
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
          if (value.length > 50) {
            throw new Error('Maximum 50 tags allowed');
          }
        }
      }
    },
    icon: {
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
    rules: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 10000]
      }
    },
    guidelines: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 10000]
      }
    },
    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'welcome_message',
      validate: {
        len: [0, 10000]
      }
    },
    memberCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'member_count',
      validate: {
        min: 0
      }
    },
    maxMembers: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'max_members',
      validate: {
        min: 1,
        max: 100000
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_featured'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified'
    },
    isNsfw: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_nsfw'
    },
    nsfwLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: 'nsfw_level',
      validate: {
        min: 0,
        max: 3
      }
    },
    visibility: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'public',
      validate: {
        isIn: [['public', 'hidden', 'restricted']]
      }
    },
    searchable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    allowInvites: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'allow_invites'
    },
    inviteOnly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'invite_only'
    },
    allowPosts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'allow_posts'
    },
    allowComments: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'allow_comments'
    },
    allowMedia: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'allow_media'
    },
    moderationLevel: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'light',
      field: 'moderation_level',
      validate: {
        isIn: [['none', 'light', 'medium', 'strict']]
      }
    },
    defaultRole: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'member',
      field: 'default_role',
      validate: {
        isIn: [['member', 'moderator', 'admin', 'owner']]
      }
    },
    roles: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        owner: { permissions: ['*'] },
        admin: { permissions: ['manage_community', 'manage_members', 'manage_content', 'manage_settings'] },
        moderator: { permissions: ['manage_content', 'manage_members'] },
        member: { permissions: ['create_content', 'comment', 'react'] }
      },
      validate: {
        isValidRoles(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Roles must be an object');
          }
        }
      }
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidSettings(value) {
          if (!value) return true;
          if (typeof value !== 'object') {
            throw new Error('Settings must be an object');
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
    tableName: 'communities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['community_id']
      },
      {
        fields: ['created_by']
      },
      {
        fields: ['name']
      },
      {
        fields: ['display_name']
      },
      {
        fields: ['type']
      },
      {
        fields: ['category']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_featured']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['visibility']
      },
      {
        fields: ['member_count']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Community;
};

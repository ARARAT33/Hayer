module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define('Service', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    serviceId: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
      field: 'service_id',
      validate: {
        notEmpty: true,
        len: [1, 180]
      }
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
        len: [0, 5000]
      }
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['social', 'messaging', 'storage', 'media', 'collaboration', 'productivity', 'entertainment', 'utility']]
      }
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
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
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    documentation: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    apiSpec: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'api_spec',
      validate: {
        len: [0, 500],
        isUrl: true
      }
    },
    isFederated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_federated'
    },
    federationProtocol: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'federation_protocol',
      validate: {
        len: [0, 50]
      }
    },
    supportsSSO: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'supports_sso'
    },
    ssoProtocols: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'sso_protocols',
      validate: {
        isValidSSOProtocols(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('SSO protocols must be an array');
          }
          const validProtocols = ['oidc', 'oauth2', 'saml', 'cas', 'webauthn'];
          const isValid = value.every(protocol => validProtocols.includes(protocol));
          if (!isValid) {
            throw new Error('Invalid SSO protocol');
          }
        }
      }
    },
    supportsOAuth: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'supports_oauth'
    },
    oauthScopes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'oauth_scopes',
      validate: {
        isValidOAuthScopes(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('OAuth scopes must be an array');
          }
        }
      }
    },
    integrationModes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      field: 'integration_modes',
      validate: {
        isValidIntegrationModes(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Integration modes must be an array');
          }
          const validModes = [
            'hayer_sso',
            'oauth_consent',
            'managed_provisioning',
            'federated_public',
            'storage_agent',
            'unsupported'
          ];
          const isValid = value.every(mode => validModes.includes(mode));
          if (!isValid) {
            throw new Error('Invalid integration mode');
          }
        }
      }
    },
    capabilities: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidCapabilities(value) {
          if (!value) return true;
          if (!Array.isArray(value)) {
            throw new Error('Capabilities must be an array');
          }
        }
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
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    popularity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    userCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'user_count',
      validate: {
        min: 0
      }
    },
    instanceCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'instance_count',
      validate: {
        min: 0
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
    tableName: 'services',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['service_id']
      },
      {
        fields: ['name']
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
        fields: ['priority']
      },
      {
        fields: ['popularity']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Service;
};

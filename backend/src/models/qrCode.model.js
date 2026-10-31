/**
 * QR Code Model
 * QR կոդերի մոդել - սելֆի ստուգման համար
 */

module.exports = (sequelize, DataTypes) => {
  const QRCode = sequelize.define('QRCode', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    // Քոդի միանշանակ նույնացուցիչ
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'code'
    },
    // Քոդի տիպ: 'age_verification', 'authentication', 'payment', 'general'
    type: {
      type: DataTypes.ENUM('age_verification', 'authentication', 'payment', 'general'),
      allowNull: false,
      defaultValue: 'age_verification',
      field: 'type'
    },
    // Տվյալներ (JSON)
    data: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    // Ստեղծողի ID
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by'
    },
    // Նպատակի համար (օգտատիրոջ ID)
    forUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'for_user_id'
    },
    // Վավեր է
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    // Օգտագործված է
    isUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_used'
    },
    // Օգտագործման ամսաթիվ
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at'
    },
    // Օգտագործողի ID
    usedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'used_by'
    },
    // Օգտագործողի IP
    usedByIp: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'used_by_ip'
    },
    // Վավերացման ժամկետ
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    // Սկանավորություն (հասանելի է սքաների համար)
    isScannable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_scannable'
    },
    // Մետադատա
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'QRCodes',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['code'],
        name: 'QRCodes_code_unique'
      },
      {
        fields: ['type'],
        name: 'QRCodes_type_idx'
      },
      {
        fields: ['created_by'],
        name: 'QRCodes_created_by_idx'
      },
      {
        fields: ['for_user_id'],
        name: 'QRCodes_for_user_id_idx'
      },
      {
        fields: ['is_active', 'is_used'],
        name: 'QRCodes_status_idx'
      },
      {
        fields: ['expires_at'],
        name: 'QRCodes_expires_at_idx'
      }
    ]
  });

  QRCode.associate = (models) => {
    QRCode.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    QRCode.belongsTo(models.User, { foreignKey: 'forUserId', as: 'targetUser' });
    QRCode.belongsTo(models.User, { foreignKey: 'usedBy', as: 'user' });
  };

  return QRCode;
};

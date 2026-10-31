/**
 * Age Verification Model
 * Հասակային ստուգման մոդել - 18+ օգտագործողների համար
 * Աջակցում է սելֆի ստուգում և QR կոդեր
 */

module.exports = (sequelize, DataTypes) => {
  const AgeVerification = sequelize.define('AgeVerification', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    // Օգտատիրոջ ID
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
    // Ստուգման մեթոդ: 'selfie', 'qr_code', 'document', 'manual'
    method: {
      type: DataTypes.ENUM('selfie', 'qr_code', 'document', 'manual'),
      allowNull: false,
      defaultValue: 'selfie',
      field: 'method'
    },
    // Հասակ (տարիներ)
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 13,
        max: 120
      }
    },
    // Ծննդյան ամսաթիվ
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'birth_date'
    },
    // Ստուգման վիճակ: 'pending', 'verified', 'rejected', 'expired'
    status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'status'
    },
    // Սելֆիի լուսանկարի URL կամ path
    selfieImagePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'selfie_image_path'
    },
    // Սելֆիի լուսանկարի hash (ինտեգրության ստուգման համար)
    selfieImageHash: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'selfie_image_hash'
    },
    // QR կոդի տվյալներ (եթե օգտագործվել է QR մեթոդ)
    qrCodeData: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'qr_code_data'
    },
    // QR կոդի համարը
    qrCodeId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'qr_code_id'
    },
    // Ստուգողի ID (ադմին կամ ավտոմատ համակարգ)
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'verified_by'
    },
    // Ստուգման ամսաթիվ
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at'
    },
    // Մերժման պատճառ
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    // Սարքի ինֆորմացիա (ընդունող սարք)
    deviceInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'device_info'
    },
    // IP հասցե
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address'
    },
    // Գեոլոկացիա (Քաղաք, Երկիր)
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'location'
    },
    // Ակտիվ է (չեղարկված չլինի)
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    // Վավերացման ժամկետ (օրեր)
    validUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'valid_until'
    },
    // Մետադատա
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'AgeVerifications',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id'],
        name: 'AgeVerifications_user_id_unique'
      },
      {
        fields: ['status'],
        name: 'AgeVerifications_status_idx'
      },
      {
        fields: ['method'],
        name: 'AgeVerifications_method_idx'
      },
      {
        fields: ['age'],
        name: 'AgeVerifications_age_idx'
      },
      {
        fields: ['verified_at'],
        name: 'AgeVerifications_verified_at_idx'
      },
      {
        fields: ['qr_code_id'],
        name: 'AgeVerifications_qr_code_id_idx'
      }
    ]
  });

  AgeVerification.associate = (models) => {
    AgeVerification.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    AgeVerification.belongsTo(models.User, { foreignKey: 'verifiedBy', as: 'verifier' });
  };

  return AgeVerification;
};

/**
 * Selfie Verification Model
 * Սելֆի ստուգման մոդել - դեմքի ճանաչում և ստուգում
 */

module.exports = (sequelize, DataTypes) => {
  const SelfieVerification = sequelize.define('SelfieVerification', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    // Ակտիվ ստուգման սեսիա
    sessionId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'session_id'
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
    // Նկարի URL կամ path
    imagePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'image_path'
    },
    // Նկարի hash (SHA-256)
    imageHash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'image_hash'
    },
    // Նկարի չափ (բայթ)
    imageSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'image_size'
    },
    // Նկարի տիպ (MIME)
    imageType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'image_type'
    },
    // Դեմքի ճանաչման արդյունք
    faceDetectionResult: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'face_detection_result'
    },
    // Դեմքի հատկանիշներ (faceprint)
    faceFeatures: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'face_features'
    },
    // Լուսավորության մակարդակ (0-100)
    brightness: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      }
    },
    // Պարպում (0-100)
    sharpness: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      }
    },
    // Աչքերի բացվածություն (0-1)
    eyeOpenness: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      },
      field: 'eye_openness'
    },
    // Բերանի վիճակ ('closed', 'open', 'smiling')
    mouthState: {
      type: DataTypes.ENUM('closed', 'open', 'smiling'),
      allowNull: true,
      field: 'mouth_state'
    },
    // Գլխի պտույտ (x, y, z առանցքներ)
    headPose: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'head_pose'
    },
    // Ակնհայտություն (0-1)
    clarity: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    // Ստուգման վիճակ
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'verified', 'rejected', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'status'
    },
    // Ստուգման տոկոս (0-100)
    confidenceScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      field: 'confidence_score'
    },
    // Մերժման պատճառ
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    // Ստուգողի ID
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
    // Սարքի ինֆորմացիա
    deviceInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'device_info'
    },
    // Բրաուզերի ինֆորմացիա
    browserInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'browser_info'
    },
    // IP հասցե
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address'
    },
    // Գեոլոկացիա
    location: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    // Մետադատա
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'SelfieVerifications',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['session_id'],
        name: 'SelfieVerifications_session_id_unique'
      },
      {
        fields: ['user_id'],
        name: 'SelfieVerifications_user_id_idx'
      },
      {
        fields: ['status'],
        name: 'SelfieVerifications_status_idx'
      },
      {
        fields: ['confidence_score'],
        name: 'SelfieVerifications_confidence_score_idx'
      },
      {
        fields: ['created_at'],
        name: 'SelfieVerifications_created_at_idx'
      }
    ]
  });

  SelfieVerification.associate = (models) => {
    SelfieVerification.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    SelfieVerification.belongsTo(models.User, { foreignKey: 'verifiedBy', as: 'verifier' });
    SelfieVerification.belongsTo(models.AgeVerification, { foreignKey: 'userId', as: 'ageVerification' });
  };

  return SelfieVerification;
};

/**
 * Age Verification Service
 * Հասակային ստուգման ծառայություն - 18+ օգտագործողների համար
 * Աջակցում է սելֆի ստուգում և QR կոդեր
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { Op } = require('sequelize');

const {
  User,
  AgeVerification,
  QRCode,
  SelfieVerification,
  AuditEvent
} = require('../models');

const {
  NotFoundError,
  ConflictError,
  ValidationError,
  AuthorizationError
} = require('../middleware/errorHandler');

const config = require('../config');

// Ակտիվ սեսիաների խորշ
const activeSessions = new Map();

/**
 * Սեսիայի ID գեներացնել
 */
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * QR կոդ գեներացնել
 */
const generateQRCode = () => {
  return crypto.randomBytes(16).toString('base64url');
};

/**
 * Նկարի hash حسابել (SHA-256)
 */
const calculateImageHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Տարիք հաշվարկել ծննդյան ամսաթվից
 */
const calculateAge = (birthDate) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Սելֆի ստուգման սեսիա սկսել
 */
const startSelfieVerification = async (userId, deviceInfo = {}, ipAddress = null) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  // Ստուգել, որ օգտատիրոջ արդեն չկա ակտիվ սեսիա
  const existingSession = await SelfieVerification.findOne({
    where: { userId, status: { [Op.in]: ['pending', 'processing'] } }
  });
  if (existingSession) {
    throw new ConflictError('Ակտիվ ստուգման սեսիա արդեն գոյություն ունի');
  }

  const sessionId = generateSessionId();
  const ageVerification = await AgeVerification.findOne({ where: { userId } });

  // Ստեղծել նոր սելֆի ստուգման սեսիա
  const selfieVerification = await SelfieVerification.create({
    sessionId,
    userId,
    status: 'pending',
    deviceInfo,
    ipAddress,
    metadata: {
      startedAt: new Date().toISOString(),
      userAgent: deviceInfo.userAgent || null
    }
  });

  // Թարմացնել օգտագործողի սեսիայի ID
  await user.update({
    ageVerificationSessionId: sessionId,
    ageVerificationStatus: 'pending'
  });

  // Գրել աուդիտի լոգ
  await AuditEvent.create({
    userId,
    action: 'age_verification.selfie.start',
    entityType: 'age_verification',
    entityId: selfieVerification.id,
    metadata: { sessionId, method: 'selfie' },
    status: 'initiated'
  });

  return {
    success: true,
    sessionId,
    verificationId: selfieVerification.id,
    message: 'Սելֆի ստուգման սեսիան սկսվել է',
    expiresIn: 300 // 5 րոպե
  };
};

/**
 * Սելֆի նկար վերբեռնել
 */
const uploadSelfieImage = async (userId, sessionId, imageBuffer, imageType = 'image/jpeg') => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  // Ստուգել սեսիան
  const selfieVerification = await SelfieVerification.findOne({
    where: { sessionId, userId, status: 'pending' }
  });
  if (!selfieVerification) {
    throw new NotFoundError('Ստուգման սեսիան չի գտնվել կամ արդեն ավարտված է');
  }

  // Ստուգել նկարի չափը (մաքսիմում 10MB)
  if (imageBuffer.length > 10 * 1024 * 1024) {
    throw new ValidationError('Նկարի չափը չպետք է գերազանցի 10MB');
  }

  // Հաշվել hash
  const imageHash = calculateImageHash(imageBuffer);

  // Պահպանել նկարը
  const uploadDir = path.join(config.storage.uploadDir, 'selfies');
  await fs.mkdir(uploadDir, { recursive: true });

  const fileName = `${sessionId}_${Date.now()}.jpg`;
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, imageBuffer);

  // Թարմացնել սելֆի ստուգման տվյալները
  await selfieVerification.update({
    imagePath: filePath,
    imageHash,
    imageSize: imageBuffer.length,
    imageType,
    status: 'processing'
  });

  // Գրել աուդիտի լոգ
  await AuditEvent.create({
    userId,
    action: 'age_verification.selfie.upload',
    entityType: 'age_verification',
    entityId: selfieVerification.id,
    metadata: { sessionId, imageSize: imageBuffer.length, imageHash },
    status: 'processing'
  });

  return {
    success: true,
    sessionId,
    imagePath: filePath,
    message: 'Սելֆի նկարը վերբեռնվել է, ստուգում է գործարկվում...'
  };
};

/**
 * Սելֆի ստուգում (դեմքի ճանաչում)
 * Սիմուլյացիա - իրական համակարգում կօգտագործվի AI ծառայություն
 */
const verifySelfie = async (sessionId, userId) => {
  const selfieVerification = await SelfieVerification.findOne({
    where: { sessionId, userId, status: 'processing' },
    include: [User]
  });
  if (!selfieVerification) {
    throw new NotFoundError('Ստուգման սեսիան չի գտնվել');
  }

  const user = selfieVerification.user;

  // Սիմուլյացիա - դեմքի ճանաչում
  const faceDetectionResult = {
    facesDetected: 1,
    faceBox: { x: 100, y: 100, width: 200, height: 200 },
    confidence: 0.98,
    isRealFace: true,
    livenessScore: 0.95
  };

  // Ստուգել դեմքի հատկանիշները
  const brightness = Math.random() * 30 + 40; // 40-70%
  const sharpness = Math.random() * 20 + 60; // 60-80%
  const clarity = Math.random() * 15 + 70; // 70-85%
  const eyeOpenness = Math.random() * 0.3 + 0.7; // 0.7-1.0
  const confidenceScore = Math.random() * 20 + 80; // 80-100%

  // Թարմացնել ստուգման տվյալները
  await selfieVerification.update({
    faceDetectionResult,
    brightness,
    sharpness,
    clarity,
    eyeOpenness,
    mouthState: 'closed',
    confidenceScore,
    status: confidenceScore >= 85 ? 'verified' : 'rejected',
    verifiedAt: new Date(),
    rejectionReason: confidenceScore < 85 ? 'Դեմքի ստուգումը ձախողվել է' : null
  });

  // Ստուգել, որ օգտատիրոջ տարիքը 18+ է
  const age = calculateAge(user.birthDate);
  const isAgeVerified = age >= 18;

  // Թարմացնել օգտատիրոջ տվյալները
  await user.update({
    age,
    isAgeVerified,
    ageVerificationMethod: 'selfie',
    ageVerificationStatus: isAgeVerified ? 'verified' : 'rejected',
    ageVerificationSessionId: null
  });

  // Ստեղծել կամ թարմացնել հասակային ստուգման ռեկորդ
  let ageVerification = await AgeVerification.findOne({ where: { userId: user.id } });
  if (!ageVerification) {
    ageVerification = await AgeVerification.create({
      userId: user.id,
      method: 'selfie',
      age,
      birthDate: user.birthDate,
      status: isAgeVerified ? 'verified' : 'rejected',
      selfieImagePath: selfieVerification.imagePath,
      selfieImageHash: selfieVerification.imageHash,
      verifiedAt: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 տարի
    });
  } else {
    await ageVerification.update({
      method: 'selfie',
      age,
      birthDate: user.birthDate,
      status: isAgeVerified ? 'verified' : 'rejected',
      selfieImagePath: selfieVerification.imagePath,
      selfieImageHash: selfieVerification.imageHash,
      verifiedAt: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
  }

  // Գրել աուդիտի լոգ
  await AuditEvent.create({
    userId: user.id,
    action: 'age_verification.selfie.verify',
    entityType: 'age_verification',
    entityId: ageVerification.id,
    metadata: {
      sessionId,
      age,
      isAgeVerified,
      confidenceScore,
      method: 'selfie'
    },
    status: isAgeVerified ? 'success' : 'failed'
  });

  return {
    success: true,
    isAgeVerified,
    age,
    confidenceScore,
    message: isAgeVerified ? 'Սելֆի ստուգումը հաջողվել է' : 'Սելֆի ստուգումը ձախողվել է'
  };
};

/**
 * QR կոդ գեներացնել ասակային ստուգման համար
 */
const generateAgeVerificationQRCode = async (userId, deviceInfo = {}, ipAddress = null) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  // Ստուգել, որ օգտատիրոջ չունի արդեն ակտիվ QR կոդ
  const existingQR = await QRCode.findOne({
    where: {
      forUserId: userId,
      type: 'age_verification',
      isActive: true,
      isUsed: false
    }
  });
  if (existingQR) {
    return {
      success: true,
      qrCodeId: existingQR.id,
      code: existingQR.code,
      message: 'QR կոդը արդեն գոյություն ունի'
    };
  }

  const qrCodeId = generateQRCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 րոպե

  // Ստեղծել QR կոդ
  const qrCode = await QRCode.create({
    code: qrCodeId,
    type: 'age_verification',
    data: {
      userId: user.id,
      username: user.username,
      purpose: 'age_verification',
      createdAt: new Date().toISOString()
    },
    createdBy: user.id,
    forUserId: user.id,
    isActive: true,
    isScannable: true,
    expiresAt,
    deviceInfo,
    ipAddress,
    metadata: {
      userAgent: deviceInfo.userAgent || null
    }
  });

  // Թարմացնել օգտատիրոջ սեսիայի ID
  await user.update({
    ageVerificationSessionId: qrCode.id,
    ageVerificationStatus: 'pending'
  });

  // Գրել աուդիտի լոգ
  await AuditEvent.create({
    userId: user.id,
    action: 'age_verification.qr.generate',
    entityType: 'qr_code',
    entityId: qrCode.id,
    metadata: { qrCodeId, type: 'age_verification' },
    status: 'created'
  });

  return {
    success: true,
    qrCodeId: qrCode.id,
    code: qrCodeId,
    expiresAt: qrCode.expiresAt,
    message: 'QR կոդ գեներացվել է'
  };
};

/**
 * QR կոդով ասակային ստուգում
 */
const verifyAgeWithQRCode = async (qrCodeId, userId, selfieSessionId = null) => {
  const qrCode = await QRCode.findOne({
    where: {
      code: qrCodeId,
      type: 'age_verification',
      isActive: true,
      isUsed: false
    },
    include: [User]
  });

  if (!qrCode) {
    throw new NotFoundError('QR կոդը չի գտնվել կամ արդեն օգտագործված է');
  }

  if (qrCode.expiresAt && qrCode.expiresAt < new Date()) {
    throw new ValidationError('QR կոդի ժամկետը լրացել է');
  }

  const targetUser = qrCode.targetUser;
  if (!targetUser) {
    throw new NotFoundError('Նպատակի համար օգտատիրոջ չի գտնվել');
  }

  // Ստուգել, որ սեսիան համապատասխանի
  if (selfieSessionId && targetUser.ageVerificationSessionId !== selfieSessionId) {
    throw new ValidationError('QR կոդը և սեսիան չեն համապատասխանում');
  }

  // Ստուգել սելֆի ստուգման սեսիան
  let selfieVerification = null;
  if (selfieSessionId) {
    selfieVerification = await SelfieVerification.findOne({
      where: { sessionId: selfieSessionId, userId: targetUser.id, status: 'verified' }
    });
    if (!selfieVerification) {
      throw new NotFoundError('Սելֆի ստուգման սեսիան չի գտնվել կամ չի հաստատվել');
    }
  }

  // Հաշվել տարիք
  const age = calculateAge(targetUser.birthDate);
  const isAgeVerified = age >= 18;

  // Նշել QR կոդը որպես օգտագործված
  await qrCode.update({
    isUsed: true,
    usedAt: new Date(),
    usedBy: userId,
    isActive: false
  });

  // Թարմացնել օգտատիրոջ տվյալները
  await targetUser.update({
    age,
    isAgeVerified,
    ageVerificationMethod: 'qr_code',
    ageVerificationStatus: isAgeVerified ? 'verified' : 'rejected',
    ageVerificationSessionId: null
  });

  // Ստեղծել կամ թարմացնել հասակային ստուգման ռեկորդ
  let ageVerification = await AgeVerification.findOne({ where: { userId: targetUser.id } });
  if (!ageVerification) {
    ageVerification = await AgeVerification.create({
      userId: targetUser.id,
      method: 'qr_code',
      age,
      birthDate: targetUser.birthDate,
      status: isAgeVerified ? 'verified' : 'rejected',
      qrCodeId: qrCode.code,
      verifiedAt: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
  } else {
    await ageVerification.update({
      method: 'qr_code',
      age,
      birthDate: targetUser.birthDate,
      status: isAgeVerified ? 'verified' : 'rejected',
      qrCodeId: qrCode.code,
      verifiedAt: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
  }

  // Գրել աուդիտի լոգ
  await AuditEvent.create({
    userId: targetUser.id,
    action: 'age_verification.qr.verify',
    entityType: 'age_verification',
    entityId: ageVerification.id,
    metadata: {
      qrCodeId,
      age,
      isAgeVerified,
      method: 'qr_code',
      verifiedBy: userId
    },
    status: isAgeVerified ? 'success' : 'failed'
  });

  return {
    success: true,
    isAgeVerified,
    age,
    userId: targetUser.id,
    username: targetUser.username,
    message: isAgeVerified ? 'QR կոդով ասակային ստուգումը հաջողվել է' : 'QR կոդով ասակային ստուգումը ձախողվել է'
  };
};

/**
 * Օգտատիրոջ ասակային ստուգման վիճակ ստանալ
 */
const getAgeVerificationStatus = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: AgeVerification,
        order: [['createdAt', 'DESC']],
        limit: 1
      },
      {
        model: SelfieVerification,
        where: { status: { [Op.in]: ['pending', 'processing', 'verified'] } },
        order: [['createdAt', 'DESC']],
        limit: 1,
        required: false
      }
    ]
  });

  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  const ageVerification = user.AgeVerifications && user.AgeVerifications[0];
  const activeSelfie = user.SelfieVerifications && user.SelfieVerifications[0];

  const age = user.age || (user.birthDate ? calculateAge(user.birthDate) : null);

  return {
    userId: user.id,
    username: user.username,
    age,
    birthDate: user.birthDate,
    isAgeVerified: user.isAgeVerified,
    ageVerificationMethod: user.ageVerificationMethod,
    ageVerificationStatus: user.ageVerificationStatus,
    ageVerificationSessionId: user.ageVerificationSessionId,
    lastVerification: ageVerification ? {
      id: ageVerification.id,
      method: ageVerification.method,
      status: ageVerification.status,
      verifiedAt: ageVerification.verifiedAt,
      validUntil: ageVerification.validUntil,
      age: ageVerification.age
    } : null,
    activeSelfieSession: activeSelfie ? {
      id: activeSelfie.id,
      sessionId: activeSelfie.sessionId,
      status: activeSelfie.status,
      createdAt: activeSelfie.createdAt
    } : null,
    hasCamera: user.hasCamera,
    canVerify: age && age >= 18
  };
};

/**
 * Ստուգել, որ օգտատիրոջ 18+ է
 */
const checkAgeVerification = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  // Եթե օգտատիրոջ տարիքը արդեն հաստատված է
  if (user.isAgeVerified) {
    return {
      success: true,
      isAgeVerified: true,
      age: user.age,
      message: 'Օգտատիրոջ տարիքային ստուգումը հաստատված է'
    };
  }

  // Եթե օգտատիրոջ տարիքային ստուգման սեսիա է գործում
  if (user.ageVerificationStatus === 'pending') {
    return {
      success: false,
      isAgeVerified: false,
      requiresVerification: true,
      message: 'Օգտատիրոջ տարիքային ստուգում է սպասման մեջ',
      sessionId: user.ageVerificationSessionId
    };
  }

  // Ստուգել տարիքը
  const age = user.age || (user.birthDate ? calculateAge(user.birthDate) : null);

  if (age && age >= 18) {
    // Ավտոմատ հաստատում (եթե տարիքը արդեն հայտնի է)
    await user.update({
      isAgeVerified: true,
      ageVerificationMethod: 'auto',
      ageVerificationStatus: 'verified'
    });

    return {
      success: true,
      isAgeVerified: true,
      age,
      message: 'Օգտատիրոջ տարիքային ստուգումը հաստատված է (ավտոմատ)'
    };
  }

  return {
    success: false,
    isAgeVerified: false,
    requiresVerification: true,
    age,
    message: 'Օգտատիրոջ տարիքային ստուգում է անհրաժեշտ'
  };
};

/**
 * Սարքի տեսախցիկի առկայություն ստուգել
 */
const checkDeviceCamera = async (userId, hasCamera) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  await user.update({ hasCamera });

  return {
    success: true,
    hasCamera,
    message: `Սարքի տեսախցիկի առկայությունը թարմացվել է: ${hasCamera ? 'կա' : 'չկա'}`
  };
};

/**
 * Ասակային ստուգման վիճակ թարմացնել
 */
const updateAgeVerificationStatus = async (userId, adminUserId, status, reason = null) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  const ageVerification = await AgeVerification.findOne({ where: { userId } });

  const updates = { status };
  if (reason) updates.rejectionReason = reason;

  if (ageVerification) {
    await ageVerification.update({
      ...updates,
      verifiedBy: adminUserId,
      verifiedAt: new Date()
    });
  }

  await user.update({
    isAgeVerified: status === 'verified',
    ageVerificationStatus: status
  });

  // Գրել աուդիտի լոգ
  await AuditEvent.create({
    userId: adminUserId,
    action: 'age_verification.status.update',
    entityType: 'age_verification',
    entityId: ageVerification?.id,
    metadata: { userId, status, reason },
    status: 'success'
  });

  return {
    success: true,
    status,
    userId,
    message: `Ասակային ստուգման վիճակը թարմացվել է: ${status}`
  };
};

/**
 * Ասակային ստուգման պատմություն ստանալ
 */
const getAgeVerificationHistory = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('Օգտատիրոջ չի գտնվել');

  const verifications = await AgeVerification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: 20
  });

  return {
    userId: user.id,
    username: user.username,
    history: verifications.map(v => ({
      id: v.id,
      method: v.method,
      age: v.age,
      status: v.status,
      createdAt: v.createdAt,
      verifiedAt: v.verifiedAt,
      validUntil: v.validUntil
    }))
  };
};

/**
 * Ակտիվ սեսիաներ ստանալ (ադմինի համար)
 */
const getActiveSessions = async () => {
  const sessions = await SelfieVerification.findAll({
    where: { status: { [Op.in]: ['pending', 'processing'] } },
    include: [User],
    order: [['createdAt', 'DESC']],
    limit: 100
  });

  return {
    count: sessions.length,
    sessions: sessions.map(s => ({
      id: s.id,
      sessionId: s.sessionId,
      userId: s.userId,
      username: s.user?.username,
      status: s.status,
      createdAt: s.createdAt,
      deviceInfo: s.deviceInfo
    }))
  };
};

/**
 * QR կոդեր ստանալ (ադմինի համար)
 */
const getQRCodeList = async (options = {}) => {
  const { status = null, type = 'age_verification', limit = 50, offset = 0 } = options;

  const where = { type };
  if (status) where.status = status;

  const result = await QRCode.findAndCountAll({
    where,
    include: [User],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  return {
    count: result.count,
    qrCodes: result.rows.map(q => ({
      id: q.id,
      code: q.code,
      type: q.type,
      isActive: q.isActive,
      isUsed: q.isUsed,
      createdAt: q.createdAt,
      expiresAt: q.expiresAt,
      usedAt: q.usedAt,
      userId: q.forUserId,
      username: q.targetUser?.username
    }))
  };
};

/**
 * Ասակային ստուգման վիճակագրություն (ադմինի համար)
 */
const getAgeVerificationStats = async () => {
  const [
    totalUsers,
    verifiedUsers,
    pendingUsers,
    rejectedUsers,
    expiredUsers,
    avgAge
  ] = await Promise.all([
    User.count(),
    User.count({ where: { isAgeVerified: true } }),
    User.count({ where: { ageVerificationStatus: 'pending' } }),
    User.count({ where: { ageVerificationStatus: 'rejected' } }),
    User.count({ where: { ageVerificationStatus: 'expired' } }),
    User.findAll({
      attributes: [[sequelize.fn('AVG', sequelize.col('age')), 'avgAge']],
      raw: true
    })
  ]);

  return {
    totalUsers,
    verifiedUsers,
    pendingUsers,
    rejectedUsers,
    expiredUsers,
    avgAge: avgAge[0]?.avgAge || 0,
    verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100) : 0
  };
};

module.exports = {
  // Սելֆի ստուգում
  startSelfieVerification,
  uploadSelfieImage,
  verifySelfie,

  // QR կոդով ստուգում
  generateAgeVerificationQRCode,
  verifyAgeWithQRCode,

  // Ստատուս և ստուգում
  getAgeVerificationStatus,
  checkAgeVerification,
  checkDeviceCamera,

  // Կառավարում
  updateAgeVerificationStatus,
  getAgeVerificationHistory,

  // Ադմինիստրատոր
  getActiveSessions,
  getQRCodeList,
  getAgeVerificationStats,

  // Ուտիլիտար ֆունկցիաներ
  calculateAge,
  generateSessionId,
  generateQRCode
};

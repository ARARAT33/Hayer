/**
 * Age Verification Controller
 * Հասակային ստուգման կոնտրոլեր
 */

const ageVerificationService = require('../services/ageVerification.service');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Սելֆի ստուգման սեսիա սկսել
 */
const startSelfieVerification = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;
  const deviceInfo = req.body.deviceInfo || {};
  const ipAddress = req.ip || req.connection.remoteAddress;

  const result = await ageVerificationService.startSelfieVerification(
    userId,
    deviceInfo,
    ipAddress
  );

  res.json({
    success: true,
    ...result
  });
});

/**
 * Սելֆի նկար վերբեռնել
 */
const uploadSelfieImage = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;
  const { sessionId } = req.params;

  if (!req.file && !req.body.image) {
    return res.status(400).json({
      success: false,
      error: 'Նկարի ֆայլ կամ տվյալներ չեն տրամադրվել'
    });
  }

  const imageBuffer = req.file ? req.file.buffer : Buffer.from(req.body.image, 'base64');
  const imageType = req.file ? req.file.mimetype : req.body.imageType || 'image/jpeg';

  const result = await ageVerificationService.uploadSelfieImage(
    userId,
    sessionId,
    imageBuffer,
    imageType
  );

  res.json({
    success: true,
    ...result
  });
});

/**
 * Սելֆի ստուգում (ավտոմատ)
 */
const verifySelfie = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;
  const { sessionId } = req.params;

  const result = await ageVerificationService.verifySelfie(sessionId, userId);

  res.json({
    success: true,
    ...result
  });
});

/**
 * QR կոդ գեներացնել ասակային ստուգման համար
 */
const generateQRCode = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;
  const deviceInfo = req.body.deviceInfo || {};
  const ipAddress = req.ip || req.connection.remoteAddress;

  const result = await ageVerificationService.generateAgeVerificationQRCode(
    userId,
    deviceInfo,
    ipAddress
  );

  res.json({
    success: true,
    ...result
  });
});

/**
 * QR կոդով ասակային ստուգում
 */
const verifyWithQRCode = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;
  const { qrCodeId } = req.params;
  const { selfieSessionId } = req.body;

  const result = await ageVerificationService.verifyAgeWithQRCode(
    qrCodeId,
    userId,
    selfieSessionId
  );

  res.json({
    success: true,
    ...result
  });
});

/**
 * Օգտատիրոջ ասակային ստուգման վիճակ ստանալ
 */
const getStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;

  const result = await ageVerificationService.getAgeVerificationStatus(userId);

  res.json({
    success: true,
    ...result
  });
});

/**
 * Ստուգել, որ օգտատիրոջ 18+ է
 */
const checkVerification = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;

  const result = await ageVerificationService.checkAgeVerification(userId);

  if (!result.success) {
    return res.status(403).json(result);
  }

  res.json(result);
});

/**
 * Սարքի տեսախցիկի առկայություն ստուգել
 */
const checkCamera = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;
  const { hasCamera } = req.body;

  const result = await ageVerificationService.checkDeviceCamera(userId, hasCamera);

  res.json({
    success: true,
    ...result
  });
});

/**
 * Ասակային ստուգման պատմություն ստանալ
 */
const getHistory = asyncHandler(async (req, res, next) => {
  const { userId } = req.user;

  const result = await ageVerificationService.getAgeVerificationHistory(userId);

  res.json({
    success: true,
    ...result
  });
});

/**
 * Ակտիվ սեսիաներ ստանալ (ադմին)
 */
const getActiveSessions = asyncHandler(async (req, res, next) => {
  const result = await ageVerificationService.getActiveSessions();

  res.json({
    success: true,
    ...result
  });
});

/**
 * QR կոդեր ստանալ (ադմին)
 */
const getQRCodeList = asyncHandler(async (req, res, next) => {
  const options = req.query;
  const result = await ageVerificationService.getQRCodeList(options);

  res.json({
    success: true,
    ...result
  });
});

/**
 * Ասակային ստուգման վիճակագրություն (ադմին)
 */
const getStats = asyncHandler(async (req, res, next) => {
  const result = await ageVerificationService.getAgeVerificationStats();

  res.json({
    success: true,
    ...result
  });
});

/**
 * Ասակային ստուգման վիճակ թարմացնել (ադմին)
 */
const updateStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { status, reason } = req.body;
  const { userId: adminUserId } = req.user;

  const result = await ageVerificationService.updateAgeVerificationStatus(
    userId,
    adminUserId,
    status,
    reason
  );

  res.json({
    success: true,
    ...result
  });
});

/**
 * Կոնկրետ օգտատիրոջ ասակային ստուգման վիճակ (ադմին)
 */
const getUserStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const result = await ageVerificationService.getAgeVerificationStatus(userId);

  res.json({
    success: true,
    ...result
  });
});

/**
 * Կոնկրետ օգտատիրոջ ասակային ստուգման պատմություն (ադմին)
 */
const getUserHistory = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const result = await ageVerificationService.getAgeVerificationHistory(userId);

  res.json({
    success: true,
    ...result
  });
});

module.exports = {
  // Սելֆի ստուգում
  startSelfieVerification,
  uploadSelfieImage,
  verifySelfie,

  // QR կոդով ստուգում
  generateQRCode,
  verifyWithQRCode,

  // Ստատուս և ստուգում
  getStatus,
  checkVerification,
  checkCamera,
  getHistory,

  // Ադմինիստրատոր
  getActiveSessions,
  getQRCodeList,
  getStats,
  updateStatus,
  getUserStatus,
  getUserHistory
};

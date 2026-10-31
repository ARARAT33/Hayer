/**
 * Age Verification Routes
 * Հասակային ստուգման մարշրուտներ
 */

const express = require('express');
const router = express.Router();
const ageVerificationController = require('../controllers/ageVerification.controller');
const { jwtAuth, isAdmin, checkPermission } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const config = require('../config');

// Rate limiting
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 րոպե
  max: 5,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Չի կարելի շատ հաճախ փորձել ստուգում կատարել. Խնդրում ենք սպասել 15 րոպե.',
    timestamp: new Date().toISOString()
  }
});

// Multer configuration for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Միայն պատկերների ֆայլեր են թույլատրված'), false);
    }
  }
});

// ============================================
// Հանրային մարշրուտներ (բոլորի համար)
// ============================================

// Սելֆի ստուգման սեսիա սկսել (պարտադրական JWT)
router.post(
  '/selfie/start',
  jwtAuth(),
  verificationLimiter,
  asyncHandler(ageVerificationController.startSelfieVerification)
);

// Սելֆի նկարի վերբեռնում
router.post(
  '/selfie/upload/:sessionId',
  jwtAuth(),
  upload.single('image'),
  asyncHandler(ageVerificationController.uploadSelfieImage)
);

// Սելֆի ստուգում (ավտոմատ)
router.post(
  '/selfie/verify/:sessionId',
  jwtAuth(),
  asyncHandler(ageVerificationController.verifySelfie)
);

// QR կոդ գեներացնել
router.post(
  '/qr/generate',
  jwtAuth(),
  verificationLimiter,
  asyncHandler(ageVerificationController.generateQRCode)
);

// QR կոդով ստուգում
router.post(
  '/qr/verify/:qrCodeId',
  jwtAuth(),
  asyncHandler(ageVerificationController.verifyWithQRCode)
);

// Ստատուս ստանալ
router.get(
  '/status',
  jwtAuth(),
  asyncHandler(ageVerificationController.getStatus)
);

// Ստուգել 18+ (վերադարձնում է 403 եթե չկա հաստատում)
router.get(
  '/check',
  jwtAuth(),
  asyncHandler(ageVerificationController.checkVerification)
);

// Սարքի տեսախցիկի առկայություն թարմացնել
router.post(
  '/camera',
  jwtAuth(),
  asyncHandler(ageVerificationController.checkCamera)
);

// Պատմություն
router.get(
  '/history',
  jwtAuth(),
  asyncHandler(ageVerificationController.getHistory)
);

// ============================================
// Ադմինիստրատորի մարշրուտներ
// ============================================

// Ակտիվ սեսիաներ
router.get(
  '/admin/sessions',
  jwtAuth(),
  isAdmin,
  checkPermission('age_verification.read'),
  asyncHandler(ageVerificationController.getActiveSessions)
);

// QR կոդեր
router.get(
  '/admin/qr-codes',
  jwtAuth(),
  isAdmin,
  checkPermission('age_verification.read'),
  asyncHandler(ageVerificationController.getQRCodeList)
);

// Վիճակագրություն
router.get(
  '/admin/stats',
  jwtAuth(),
  isAdmin,
  checkPermission('age_verification.read'),
  asyncHandler(ageVerificationController.getStats)
);

// Ստատուս թարմացնել
router.patch(
  '/admin/users/:userId/status',
  jwtAuth(),
  isAdmin,
  checkPermission('age_verification.write'),
  asyncHandler(ageVerificationController.updateStatus)
);

// Օգտատիրոջ ստատուս
router.get(
  '/admin/users/:userId/status',
  jwtAuth(),
  isAdmin,
  checkPermission('age_verification.read'),
  asyncHandler(ageVerificationController.getUserStatus)
);

// Օգտատիրոջ պատմություն
router.get(
  '/admin/users/:userId/history',
  jwtAuth(),
  isAdmin,
  checkPermission('age_verification.read'),
  asyncHandler(ageVerificationController.getUserHistory)
);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'age_verification',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

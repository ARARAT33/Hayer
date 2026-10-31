/**
 * QR Code Utility
 * QR կոդերի գեներացում և սկանավորում
 */

const qr = require('qr-image');
const crypto = require('crypto');
const { createCanvas } = require('canvas');

/**
 * QR կոդ գեներացնել
 * @param {string} data - Տվյալներ, որոնք պետք է կոդավորել
 * @param {object} options - Օպցիոնալ պարամետրեր
 * @returns {Buffer} - QR կոդի պատկեր
 */
const generateQRCode = (data, options = {}) => {
  const {
    size = 200,
    type = 'png',
    margin = 2,
    color = { dark: '#000000', light: '#FFFFFF' }
  } = options;

  try {
    const qrCode = qr.image(data, {
      type,
      size,
      margin,
      ec_level: 'H',
      parse_url: false
    });

    return qrCode;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * QR կոդ գեներացնել Base64 ձևաչափով
 */
const generateQRCodeBase64 = (data, options = {}) => {
  const buffer = generateQRCode(data, options);
  return buffer.toString('base64');
};

/**
 * QR կոդ գեներացնել Data URL ձևաչափով
 */
const generateQRCodeDataURL = (data, options = {}) => {
  const buffer = generateQRCode(data, options);
  const base64 = buffer.toString('base64');
  const type = options.type || 'png';
  return `data:image/${type};base64,${base64}`;
};

/**
 * QR կոդ գեներացնել HTML img tag-ի համար
 */
const generateQRCodeHTML = (data, options = {}) => {
  const dataURL = generateQRCodeDataURL(data, options);
  const { width, height, alt = 'QR Code' } = options;
  const size = width || height || 200;
  return `<img src="${dataURL}" width="${size}" height="${size}" alt="${alt}" />`;
};

/**
 * Քոդ գեներացնել QR կոդի համար
 */
const generateCode = (length = 16) => {
  return crypto.randomBytes(length).toString('base64url').substring(0, length);
};

/**
 * Հաստատման կոդ գեներացնել
 */
const generateVerificationCode = (length = 6) => {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
};

/**
 * QR կոդի տվյալներ վավերացնել
 */
const validateQRData = (data) => {
  if (!data) {
    return { valid: false, error: 'Data is required' };
  }

  if (typeof data !== 'string' && typeof data !== 'object') {
    return { valid: false, error: 'Data must be a string or object' };
  }

  // Եթե օբյեկտ է, ստուգել, որ չի գերազանցում չափը
  if (typeof data === 'object') {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 1000) {
      return { valid: false, error: 'Data is too large' };
    }
  } else if (data.length > 1000) {
    return { valid: false, error: 'Data is too large' };
  }

  return { valid: true };
};

/**
 * QR կոդի պատկեր ստեղծել Canvas-ով
 */
const createQRCodeCanvas = (data, options = {}) => {
  const {
    size = 200,
    margin = 2,
    darkColor = '#000000',
    lightColor = '#FFFFFF',
    logo = null,
    logoSize = 0.2
  } = options;

  // Գեներացնել QR կոդ
  const qrCode = qr.imageSync(data, {
    type: 'svg',
    size: 1,
    margin: 0
  });

  // Ստեղծել Canvas
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Նշել ֆոն
  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, size, size);

  // Նկարել QR կոդ
  ctx.fillStyle = darkColor;
  ctx.fillRect(margin, margin, size - margin * 2, size - margin * 2);

  // Եթե կա լոգո
  if (logo) {
    const logoWidth = size * logoSize;
    const logoHeight = size * logoSize;
    const logoX = (size - logoWidth) / 2;
    const logoY = (size - logoHeight) / 2;

    // Նկարել լոգո
    // (Այստեղ կպետք է լոգոյի պատկերը նակարել)
  }

  return canvas;
};

/**
 * QR կոդի պատկեր ստանալ SVG ձևաչափով
 */
const generateQRCodeSVG = (data, options = {}) => {
  const { size = 200, margin = 2, color = { dark: '#000000', light: '#FFFFFF' } } = options;

  try {
    const svg = qr.imageSync(data, {
      type: 'svg',
      size: 1,
      margin: margin / size
    });

    return svg.toString('utf8');
  } catch (error) {
    console.error('Failed to generate QR code SVG:', error);
    throw new Error('Failed to generate QR code SVG');
  }
};

/**
 * QR կոդի պատկեր ստանալ PDF ձևաչափով
 */
const generateQRCodePDF = (data, options = {}) => {
  const { size = 200, margin = 2 } = options;

  try {
    const pdf = qr.imageSync(data, {
      type: 'pdf',
      size: 1,
      margin: margin / size
    });

    return pdf;
  } catch (error) {
    console.error('Failed to generate QR code PDF:', error);
    throw new Error('Failed to generate QR code PDF');
  }
};

/**
 * QR կոդի տվյալներ դեկոդավորել
 * (Նշում: Սա սիմուլյացիա է, իրական կոդով կօգտագործվի քանոնական գրադարան)
 */
const decodeQRCode = (imageBuffer) => {
  // Սա սիմուլյացիա է
  // Իրականում կօգտագործվի qrcode-reader կամ նմանատիպ գրադարան
  return { success: false, error: 'QR code decoding not implemented' };
};

/**
 * QR կոդի տվյալներ ստուգել
 */
const verifyQRCodeData = (data, expectedData) => {
  if (typeof data === 'object') {
    return JSON.stringify(data) === JSON.stringify(expectedData);
  }
  return data === expectedData;
};

/**
 * QR կոդի ժամկետ ստուգել
 */
const checkQRCodeExpiration = (expiresAt) => {
  if (!expiresAt) return true; // Եթե ժամկետ չկա, համարվում է վավեր
  return new Date() < new Date(expiresAt);
};

/**
 * QR կոդի վիճակ ստուգել
 */
const checkQRCodeStatus = (qrCode) => {
  const now = new Date();

  if (!qrCode.isActive) {
    return { status: 'inactive', message: 'QR կոդը անակտիվ է' };
  }

  if (qrCode.isUsed) {
    return { status: 'used', message: 'QR կոդը արդեն օգտագործված է' };
  }

  if (qrCode.expiresAt && now > new Date(qrCode.expiresAt)) {
    return { status: 'expired', message: 'QR կոդի ժամկետը լրացել է' };
  }

  return { status: 'valid', message: 'QR կոդը վավեր է' };
};

module.exports = {
  generateQRCode,
  generateQRCodeBase64,
  generateQRCodeDataURL,
  generateQRCodeHTML,
  generateCode,
  generateVerificationCode,
  validateQRData,
  createQRCodeCanvas,
  generateQRCodeSVG,
  generateQRCodePDF,
  decodeQRCode,
  verifyQRCodeData,
  checkQRCodeExpiration,
  checkQRCodeStatus
};

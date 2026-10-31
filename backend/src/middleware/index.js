/**
 * Middleware Index
 * Բոլոր միջանկյալ ծրագրերի էքսպորտ
 */

const security = require('./security');
const errorHandler = require('./errorHandler');
const requestLogger = require('./requestLogger');
const authentication = require('./authentication');
const ageVerification = require('./ageVerification');

module.exports = {
  // Անվտանգության միջանկյալ ծրագրեր
  ...security,

  // Սխալների վերահսկում
  ...errorHandler,

  // Պահանջների լոգավորում
  ...requestLogger,

  // Ավտենտիկացիա
  ...authentication,

  // Հասակային ստուգում
  ...ageVerification
};

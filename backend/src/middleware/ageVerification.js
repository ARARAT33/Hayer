/**
 * Age Verification Middleware
 * Հասակային ստուգման միջանկյալ ծրագրեր
 */

const ageVerificationService = require('../services/ageVerification.service');
const { AuthorizationError, ForbiddenError } = require('./errorHandler');

/**
 * Ստուգել, որ օգտատիրոջ 18+ է
 * Եթե չի, վերադարձնում է 403 սխալ
 */
const requireAgeVerification = (options = {}) => {
  const { strict = true, redirect = null } = options;

  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      if (!userId) {
        throw new AuthorizationError('Հարյուր կարող եք մուտք գործել համակարգ');
      }

      const result = await ageVerificationService.checkAgeVerification(userId);

      if (!result.isAgeVerified) {
        if (strict) {
          throw new ForbiddenError(
            'Դուք պետք է հաստատեք, որ 18 տարեկան կամ ավելի եք, որպեսզի մուտք գործեք այս էջ',
            { requiresAgeVerification: true }
          );
        }

        // Եթե redirect է տրամադրված
        if (redirect) {
          return res.redirect(303, redirect);
        }

        // Վերադարձնել սխալ՝ ստուգման անհրաժեշտության մասին
        return res.status(403).json({
          success: false,
          error: 'AGE_VERIFICATION_REQUIRED',
          message: 'Դուք պետք է հաստատեք, որ 18 տարեկան կամ ավելի եք',
          requiresAgeVerification: true,
          sessionId: result.sessionId
        });
      }

      // Ավելացնել օգտատիրոջ տարիքային տվյալները request-ում
      req.user.age = result.age;
      req.user.isAgeVerified = result.isAgeVerified;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ստուգել, որ օգտատիրոջ տարիքային ստուգում է սպասման մեջ
 * Օգտագործվում է ստուգման էջում
 */
const checkAgeVerificationPending = async (req, res, next) => {
  try {
    const { userId } = req.user;
    if (!userId) {
      throw new AuthorizationError('Հարյուր կարող եք մուտք գործել համակարգ');
    }

    const result = await ageVerificationService.getAgeVerificationStatus(userId);

    if (result.ageVerificationStatus === 'pending') {
      req.ageVerification = result;
      return next();
    }

    // Եթե արդեն հաստատված է
    if (result.isAgeVerified) {
      return res.redirect(303, '/verified');
    }

    // Եթե չկա սեսիա, վերադիրեկտ անել ստուգման էջ
    return res.redirect(303, '/verify-age');
  } catch (error) {
    next(error);
  }
};

/**
 * Ստուգել, որ օգտատիրոջ սարքը ունի տեսախցիկ
 */
const requireCamera = (options = {}) => {
  const { redirect = null } = options;

  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      if (!userId) {
        throw new AuthorizationError('Հարյուր կարող եք մուտք գործել համակարգ');
      }

      const result = await ageVerificationService.getAgeVerificationStatus(userId);

      if (result.hasCamera === false) {
        if (redirect) {
          return res.redirect(303, redirect);
        }

        return res.status(403).json({
          success: false,
          error: 'CAMERA_REQUIRED',
          message: 'Այս գործառույթի համար անհրաժեշտ է սարք՝ տեսախցիկով',
          requiresCamera: true
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ստուգել, որ համայնքը 18+ է և օգտատիրոջ 18+ է
 */
const requireAgeRestriction = (community) => {
  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      if (!userId) {
        throw new AuthorizationError('Հարյուր կարող եք մուտք գործել համակարգ');
      }

      // Ստուգել համայնքի սահմանափակումները
      if (community.isAgeRestricted && community.requireAgeVerification) {
        const result = await ageVerificationService.checkAgeVerification(userId);
        
        if (!result.isAgeVerified) {
          throw new ForbiddenError(
            `Այս համայնքը նախատեսված է ${community.minAge}+ տարեկան օգտատերերի համար`,
            { requiresAgeVerification: true, minAge: community.minAge }
          );
        }

        // Ստուգել տարիքային սահմանափակում
        if (result.age && result.age < community.minAge) {
          throw new ForbiddenError(
            `Այս համայնքը նախատեսված է ${community.minAge}+ տարեկան օգտատերերի համար`,
            { requiresAgeVerification: true, minAge: community.minAge }
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ստուգել տարիքային սահմանափակումն ըստ համայնքի ID
 */
const checkCommunityAgeRestriction = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { Community } = require('../models');

    const community = await Community.findByPk(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'COMMUNITY_NOT_FOUND',
        message: 'Համայնքը չի գտնվել'
      });
    }

    const ageCheck = requireAgeRestriction(community);
    return ageCheck(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Տարիքային խումբ ըստ տարիքի
 * Վերադարձնում է 'under_13', '13_17', '18_24', '25_34', '35_plus'
 */
const getAgeGroup = (age) => {
  if (!age) return 'unknown';
  if (age < 13) return 'under_13';
  if (age < 18) return '13_17';
  if (age < 25) return '18_24';
  if (age < 35) return '25_34';
  return '35_plus';
};

/**
 * Ստուգել, որ օգտատիրոջ տարիքային խումբը համապատասխանում է սահմանափակումներին
 */
const checkAgeGroup = (allowedGroups = []) => {
  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      if (!userId) {
        throw new AuthorizationError('Հարյուր կարող եք մուտք գործել համակարգ');
      }

      const result = await ageVerificationService.getAgeVerificationStatus(userId);
      const ageGroup = getAgeGroup(result.age);

      if (!allowedGroups.includes(ageGroup)) {
        throw new ForbiddenError(
          `Այս բովանդակությունը հասանելի է միայն ${allowedGroups.join(', ')} տարիքային խմբերի համար`,
          { ageGroup, allowedGroups }
        );
      }

      req.user.ageGroup = ageGroup;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ստուգել, որ օգտատիրոջ 18- է (18-ից ցածր)
 */
const requireUnder18 = async (req, res, next) => {
  try {
    const { userId } = req.user;
    if (!userId) {
      throw new AuthorizationError('Հարյուր կարող եք մուտք գործել համակարգ');
    }

    const result = await ageVerificationService.getAgeVerificationStatus(userId);

    if (!result.age || result.age >= 18) {
      throw new ForbiddenError(
        'Այս բովանդակությունը հասանելի է միայն 18 տարեկանից ցածր օգտատերերի համար'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Ստուգել, որ օգտատիրոջ 18+ է (18 և ավելի)
 */
const requireAdult = requireAgeVerification({ strict: true });

/**
 * Ստուգել, որ օգտատիրոջ տարիքային ստուգում է կատարվել
 * Բայց չի պահանջում 18+ (պարզապում է ցանկացած հաստատված տարիք)
 */
const requireAgeVerified = async (req, res, next) => {
  try {
    const { userId } = req.user;
    if (!userId) {
      throw new AuthorizationError('Հարյուր կարող եք մուտք գործել համակարգ');
    }

    const result = await ageVerificationService.getAgeVerificationStatus(userId);

    if (result.ageVerificationStatus !== 'verified') {
      throw new ForbiddenError(
        'Դուք պետք է հաստատեք ձեր տարիքը, որպեսզի մուտք գործեք այս էջ',
        { requiresAgeVerification: true }
      );
    }

    req.user.age = result.age;
    req.user.isAgeVerified = true;
    req.user.ageVerificationStatus = result.ageVerificationStatus;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireAgeVerification,
  checkAgeVerificationPending,
  requireCamera,
  requireAgeRestriction,
  checkCommunityAgeRestriction,
  checkAgeGroup,
  requireUnder18,
  requireAdult,
  requireAgeVerified,
  getAgeGroup
};

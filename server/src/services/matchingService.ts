import { BloodGroup, BloodComponent, RequestUrgency } from '../types';
import { DonorProfile, IDonorProfileDocument, EmergencyRequest, Notification } from '../models';
import {
  getCompatibleDonorBloodGroups,
  isExactMatch,
  isUniversalDonor,
  isBloodCompatible,
} from '../config/bloodCompatibility';
import { calculateDistanceKm, formatDistance, estimateTransitTimeMinutes } from '../utils/geo';
import { isDbConnected } from '../config/database';
import { DONOR_MATCH_RADIUS_KM } from '../config/constants';

/**
 * Normalise a district string for case-insensitive, whitespace-tolerant comparison.
 * Returns empty string when the value is absent.
 */
export function normalizeDistrict(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Returns true when both districts are non-empty and match case-insensitively.
 */
export function isSameDistrict(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = normalizeDistrict(a);
  const nb = normalizeDistrict(b);
  return na.length > 0 && nb.length > 0 && na === nb;
}

export interface MatchOptions {
  targetBloodGroup: BloodGroup;
  bloodComponent?: BloodComponent;
  urgency?: RequestUrgency;
  location: [number, number]; // [longitude, latitude]
  maxRadiusKm?: number;
  limit?: number;
  /** Optional: hospital district for same-district fallback matching */
  hospitalDistrict?: string;
}

export interface PotentialMatchResult {
  donorId: string;
  userId: string;
  donorName?: string;
  bloodGroup: BloodGroup;
  supportedComponents: BloodComponent[];
  address: {
    city: string;
    district: string;
    postalCode: string;
  };
  distanceKm: number;
  distanceFormatted: string;
  estimatedTransitTimeMinutes: number;
  matchScore: number;
  matchReasons: string[];
  isExactBloodMatch: boolean;
  /** True when matched via same-district rule (GPS may be unavailable or > radius) */
  matchedByDistrict?: boolean;
}

/**
 * Matching Engine: Calculates multi-factor ranking score for potential donor match
 */
export function calculateMatchScore(
  donor: {
    bloodGroup: BloodGroup;
    supportedComponents: BloodComponent[];
    isAvailable: boolean;
    selfReportedScreening?: {
      hasNoRecentIllness?: boolean;
      hasValidInterval?: boolean;
    };
  },
  distanceKm: number,
  options: MatchOptions
): { score: number; reasons: string[]; isExact: boolean } {
  const component = options.bloodComponent || 'WHOLE_BLOOD';
  const maxRadius = options.maxRadiusKm || DONOR_MATCH_RADIUS_KM;
  const urgency = options.urgency || 'HIGH';
  const reasons: string[] = [];

  // Base checks
  if (!donor.isAvailable) {
    return { score: 0, reasons: ['Donor currently marked unavailable'], isExact: false };
  }

  // Component check
  if (!donor.supportedComponents.includes(component)) {
    return { score: 0, reasons: [`Donor does not support ${component}`], isExact: false };
  }

  let score = 0;

  // 1. Blood Compatibility Score (up to 35 pts)
  const isExact = isExactMatch(donor.bloodGroup, options.targetBloodGroup);
  const isUniversal = isUniversalDonor(donor.bloodGroup, component);

  if (isExact) {
    score += 35;
    reasons.push(`Exact blood group match (${donor.bloodGroup})`);
  } else if (isUniversal) {
    score += 30;
    reasons.push(`Compatible universal donor (${donor.bloodGroup})`);
  } else {
    score += 25;
    reasons.push(`Compatible blood group (${donor.bloodGroup} for ${options.targetBloodGroup})`);
  }

  // 2. Proximity Score (up to 50 pts)
  if (distanceKm <= 5) {
    score += 50;
    reasons.push(`Immediate proximity (${formatDistance(distanceKm)})`);
  } else if (distanceKm <= maxRadius) {
    const proximityRatio = 1 - (distanceKm - 5) / (maxRadius - 5);
    const proximityPoints = Math.round(10 + Math.max(0, proximityRatio * 40));
    score += proximityPoints;
    reasons.push(`Within radius (${formatDistance(distanceKm)})`);
  } else {
    // Outside maxRadius
    return { score: 0, reasons: [`Exceeds search radius (${formatDistance(distanceKm)})`], isExact };
  }

  // 3. Urgency & Readiness Weighting (up to 15 pts)
  const transitMins = estimateTransitTimeMinutes(distanceKm);
  if (urgency === 'CRITICAL') {
    if (distanceKm <= 10) {
      score += 15;
      reasons.push(`Prioritized for critical urgency (~${transitMins} min transit)`);
    } else {
      score += 5;
    }
  } else if (urgency === 'HIGH') {
    if (distanceKm <= 15) {
      score += 10;
      reasons.push(`Fast transit for high urgency (~${transitMins} min transit)`);
    } else {
      score += 5;
    }
  } else {
    score += 5;
  }

  // Self-reported health indicator note (purely informational, not medical clearance)
  if (
    donor.selfReportedScreening?.hasNoRecentIllness &&
    donor.selfReportedScreening?.hasValidInterval
  ) {
    reasons.push('Self-reported donation readiness confirmed');
  }

  // Final score clamping
  const finalScore = Math.min(100, Math.max(1, score));

  return {
    score: finalScore,
    reasons,
    isExact,
  };
}

/**
 * Pure ranking function: Takes donor profiles and ranks them by match score.
 * Guaranteed to NEVER expose raw GPS coordinates in the returned structure.
 */
export function rankPotentialMatches(
  donors: IDonorProfileDocument[],
  options: MatchOptions
): PotentialMatchResult[] {
  const component = options.bloodComponent || 'WHOLE_BLOOD';
  const compatibleGroups = getCompatibleDonorBloodGroups(options.targetBloodGroup, component);

  const results: PotentialMatchResult[] = [];

  for (const donor of donors) {
    // Filter available and compatible blood group
    if (!donor.isAvailable) continue;
    if (!compatibleGroups.includes(donor.bloodGroup)) continue;
    if (!donor.supportedComponents.includes(component)) continue;

    // Calculate distance
    const distanceKm = calculateDistanceKm(options.location, donor.location.coordinates);

    // Filter by max radius
    const maxRadius = options.maxRadiusKm || DONOR_MATCH_RADIUS_KM;
    if (distanceKm > maxRadius) continue;

    // Calculate score
    const { score, reasons, isExact } = calculateMatchScore(donor, distanceKm, options);

    // Mask user object and ensure NO raw GPS coordinates leak
    let userId = '';
    let donorName: string | undefined;

    if (donor.userId) {
      const u = donor.userId as unknown as Record<string, unknown>;
      if (u._id) {
        userId = String(u._id);
        if (typeof u.name === 'string') {
          donorName = u.name;
        }
      } else {
        userId = String(donor.userId);
      }
    }

    results.push({
      donorId: donor._id.toString(),
      userId,
      donorName,
      bloodGroup: donor.bloodGroup,
      supportedComponents: donor.supportedComponents,
      address: {
        city: donor.address.city,
        district: donor.address.district,
        postalCode: donor.address.postalCode,
      },
      distanceKm,
      distanceFormatted: formatDistance(distanceKm),
      estimatedTransitTimeMinutes: estimateTransitTimeMinutes(distanceKm),
      matchScore: score,
      matchReasons: reasons,
      isExactBloodMatch: isExact,
    });
  }

  // Sort descending by matchScore, then ascending by distanceKm
  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return a.distanceKm - b.distanceKm;
  });

  const limit = options.limit || 20;
  return results.slice(0, limit);
}

/**
 * Service to query potential matches from database and return ranked results.
 *
 * When `options.hospitalDistrict` is provided, an additional pass queries donors
 * in the same district who are blood-compatible and available, regardless of GPS
 * distance.  GPS-matched donors are always included as well (union, de-duplicated).
 */
export async function findPotentialMatches(
  options: MatchOptions
): Promise<PotentialMatchResult[]> {
  const component = options.bloodComponent || 'WHOLE_BLOOD';
  const maxRadiusKm = options.maxRadiusKm || DONOR_MATCH_RADIUS_KM;
  const compatibleGroups = getCompatibleDonorBloodGroups(options.targetBloodGroup, component);

  // If database is not connected (e.g. during unit tests without DB), return empty array
  if (!isDbConnected()) {
    return [];
  }

  // ----------------------------------------------------------------
  // Pass 1: GPS-based candidates within radius
  // ----------------------------------------------------------------
  const maxDistanceMeters = maxRadiusKm * 1000;

  const gpsCandidates = await DonorProfile.find({
    isAvailable: true,
    bloodGroup: { $in: compatibleGroups },
    supportedComponents: component,
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: options.location,
        },
        $maxDistance: maxDistanceMeters,
      },
    },
  })
    .populate('userId', 'name role email status')
    .limit(options.limit ? options.limit * 2 : 50);

  // ----------------------------------------------------------------
  // Pass 2: District-based candidates (when hospitalDistrict is set)
  // ----------------------------------------------------------------
  let districtCandidates: IDonorProfileDocument[] = [];
  const hospDistrict = normalizeDistrict(options.hospitalDistrict);
  if (hospDistrict) {
    // Query all available, compatible donors â€” filter by district in-memory
    // (MongoDB does not have a normalized-string index; districts are user-supplied text)
    const allDistrictDonors = await DonorProfile.find({
      isAvailable: true,
      bloodGroup: { $in: compatibleGroups },
      supportedComponents: component,
    })
      .populate('userId', 'name role email status')
      .limit(200);

    districtCandidates = allDistrictDonors.filter((d) =>
      isSameDistrict(d.address?.district, options.hospitalDistrict)
    );
  }

  // ----------------------------------------------------------------
  // Merge: union by donorId, GPS-candidates take precedence
  // ----------------------------------------------------------------
  const seen = new Set<string>();
  const merged: IDonorProfileDocument[] = [];

  for (const d of gpsCandidates) {
    seen.add(d._id.toString());
    merged.push(d);
  }
  for (const d of districtCandidates) {
    if (!seen.has(d._id.toString())) {
      seen.add(d._id.toString());
      merged.push(d);
    }
  }

  // Filter out any donors whose user account is SUSPENDED
  const activeDonors = merged.filter((donor) => {
    if (donor.userId && typeof donor.userId === 'object' && 'status' in donor.userId) {
      return (donor.userId as { status: string }).status !== 'SUSPENDED';
    }
    return true;
  });

  // ----------------------------------------------------------------
  // Score & rank GPS candidates normally, district-only candidates
  // with a base proximity score equivalent to DONOR_MATCH_RADIUS_KM
  // ----------------------------------------------------------------
  const gpsSet = new Set(gpsCandidates.map((d) => d._id.toString()));
  const results: PotentialMatchResult[] = [];

  for (const donor of activeDonors) {
    if (!donor.isAvailable) continue;
    if (!compatibleGroups.includes(donor.bloodGroup)) continue;
    if (!donor.supportedComponents.includes(component)) continue;

    const isGps = gpsSet.has(donor._id.toString());
    const donorHasCoords =
      Array.isArray(donor.location?.coordinates) && donor.location.coordinates.length === 2;

    let distanceKm: number;
    let matchedByDistrict = false;

    if (isGps && donorHasCoords) {
      distanceKm = calculateDistanceKm(options.location, donor.location.coordinates);
    } else if (hospDistrict && isSameDistrict(donor.address?.district, options.hospitalDistrict)) {
      // District match but GPS not available or out of radius â€” assign a nominal distance
      distanceKm = donorHasCoords
        ? calculateDistanceKm(options.location, donor.location.coordinates)
        : 0;
      matchedByDistrict = true;
    } else {
      continue; // should not happen
    }

    // For district-only matches, use a synthetic GPS distance that passes the scoring
    // function's radius check. Score reflects blood group quality only (proximity = 0 km nominal).
    const scoringDistance = matchedByDistrict ? 0 : distanceKm;
    const { score, reasons, isExact } = calculateMatchScore(donor, scoringDistance, options);
    if (score === 0 && !matchedByDistrict) continue;

    let userId = '';
    let donorName: string | undefined;
    if (donor.userId) {
      const u = donor.userId as unknown as Record<string, unknown>;
      if (u._id) {
        userId = String(u._id);
        if (typeof u.name === 'string') donorName = u.name;
      } else {
        userId = String(donor.userId);
      }
    }

    results.push({
      donorId: donor._id.toString(),
      userId,
      donorName,
      bloodGroup: donor.bloodGroup,
      supportedComponents: donor.supportedComponents,
      address: {
        city: donor.address.city,
        district: donor.address.district,
        postalCode: donor.address.postalCode,
      },
      distanceKm,
      distanceFormatted: distanceKm > 0 ? formatDistance(distanceKm) : 'Same district',
      estimatedTransitTimeMinutes: distanceKm > 0 ? estimateTransitTimeMinutes(distanceKm) : 30,
      matchScore: score || 25, // district-only gets minimum blood compatibility score
      matchReasons: matchedByDistrict ? [...reasons, 'Same district as hospital'] : reasons,
      isExactBloodMatch: isExact,
      matchedByDistrict,
    });
  }

  // Sort descending by matchScore, then ascending by distanceKm
  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.distanceKm - b.distanceKm;
  });

  const limit = options.limit || 20;
  return results.slice(0, limit);
}

/**
 * Scans the database and cleans up any existing invalid acceptances or notifications
 * where an incompatible donor accepted an emergency request.
 */
export async function sanitizeIncompatibleMatches(): Promise<{
  invalidMatchesReverted: number;
  invalidNotificationsRemoved: number;
}> {
  if (!isDbConnected()) return { invalidMatchesReverted: 0, invalidNotificationsRemoved: 0 };

  let invalidMatchesReverted = 0;
  let invalidNotificationsRemoved = 0;

  // 1. Clean up invalid potential matches in EmergencyRequests
  const requests = await EmergencyRequest.find({
    'potentialMatches.status': 'ACCEPTED',
  });

  for (const req of requests) {
    let modified = false;
    for (const match of req.potentialMatches) {
      if (match.status === 'ACCEPTED') {
        const donor = await DonorProfile.findById(match.donorId);
        if (donor && !isBloodCompatible(donor.bloodGroup, req.bloodGroup, req.bloodComponent)) {
          console.log(
            `[Sanitize] Reverting invalid match: Donor ${donor.bloodGroup} for Request ${req.bloodGroup} (${req._id})`
          );
          match.status = 'DECLINED';
          invalidMatchesReverted++;
          modified = true;
        }
      }
    }

    if (modified) {
      // Recalculate request status: if active units not satisfied, revert to ACTIVE
      const validAccepted = req.potentialMatches.filter((m) => m.status === 'ACCEPTED').length;
      if (req.status === 'MATCHED' && validAccepted < req.unitsRequired) {
        req.status = 'ACTIVE';
      }
      await req.save();
    }
  }

  // 2. Clean up invalid DONOR_ACCEPTED notifications
  const acceptedNotifications = await Notification.find({ type: 'DONOR_ACCEPTED' });
  for (const notif of acceptedNotifications) {
    if (notif.data && notif.data.requestId && notif.data.donorId) {
      const [req, donor] = await Promise.all([
        EmergencyRequest.findById(notif.data.requestId),
        DonorProfile.findById(notif.data.donorId),
      ]);
      if (req && donor && !isBloodCompatible(donor.bloodGroup, req.bloodGroup, req.bloodComponent)) {
        console.log(
          `[Sanitize] Removing invalid notification ${notif._id} (Donor ${donor.bloodGroup} -> Request ${req.bloodGroup})`
        );
        await Notification.findByIdAndDelete(notif._id);
        invalidNotificationsRemoved++;
      }
    }
  }

  if (invalidMatchesReverted > 0 || invalidNotificationsRemoved > 0) {
    console.log(
      `[Sanitize] Completed: ${invalidMatchesReverted} invalid matches reverted, ${invalidNotificationsRemoved} invalid notifications removed.`
    );
  }

  return { invalidMatchesReverted, invalidNotificationsRemoved };
}



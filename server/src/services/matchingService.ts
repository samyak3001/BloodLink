import { BloodGroup, BloodComponent, RequestUrgency } from '../types';
import { DonorProfile, IDonorProfileDocument } from '../models';
import {
  getCompatibleDonorBloodGroups,
  isExactMatch,
  isUniversalDonor,
} from '../config/bloodCompatibility';
import { calculateDistanceKm, formatDistance, estimateTransitTimeMinutes } from '../utils/geo';
import { isDbConnected } from '../config/database';

export interface MatchOptions {
  targetBloodGroup: BloodGroup;
  bloodComponent?: BloodComponent;
  urgency?: RequestUrgency;
  location: [number, number]; // [longitude, latitude]
  maxRadiusKm?: number;
  limit?: number;
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
  const maxRadius = options.maxRadiusKm || 30;
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
 * Pure ranking function: Takes donor profiles and ranks them by match score
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
    const maxRadius = options.maxRadiusKm || 30;
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
 * Service to query potential matches from database and return ranked results
 */
export async function findPotentialMatches(
  options: MatchOptions
): Promise<PotentialMatchResult[]> {
  const component = options.bloodComponent || 'WHOLE_BLOOD';
  const maxRadiusKm = options.maxRadiusKm || 30;
  const compatibleGroups = getCompatibleDonorBloodGroups(options.targetBloodGroup, component);

  // If database is not connected (e.g. during unit tests without DB), return empty array
  if (!isDbConnected()) {
    return [];
  }

  // 1. Query available donors with compatible blood groups within geospatial radius
  // maxDistance in meters = maxRadiusKm * 1000
  const maxDistanceMeters = maxRadiusKm * 1000;

  const candidateDonors = await DonorProfile.find({
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

  // Filter out any donors whose user account is SUSPENDED
  const activeDonors = candidateDonors.filter((donor) => {
    if (donor.userId && typeof donor.userId === 'object' && 'status' in donor.userId) {
      return (donor.userId as { status: string }).status !== 'SUSPENDED';
    }
    return true;
  });

  // 2. Score and rank potential matches
  return rankPotentialMatches(activeDonors, options);
}

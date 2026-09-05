import { BloodGroup, BloodComponent } from '../types';

/**
 * Blood Group Compatibility Matrix
 *
 * For Red Blood Cell (RBC) & Whole Blood donation:
 * - O- recipient: ONLY O- donor
 * - O+ recipient: O+ or O- donor
 * - A- recipient: A- or O- donor
 * - A+ recipient: A+, A-, O+, O- donor
 * - B- recipient: B- or O- donor
 * - B+ recipient: B+, B-, O+, O- donor
 * - AB- recipient: AB-, A-, B-, O- donor
 * - AB+ recipient: AB+, AB-, A+, A-, B+, B-, O+, O- donor
 */
export const RED_CELL_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export const PLASMA_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A-', 'A+', 'AB-', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B-', 'B+', 'AB-', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB-', 'AB+'],
};

/**
 * Get all compatible donor blood groups for a given recipient
 */
export function getCompatibleDonorBloodGroups(
  recipientGroup: BloodGroup,
  component: BloodComponent = 'WHOLE_BLOOD'
): BloodGroup[] {
  if (component === 'PLASMA') {
    return PLASMA_COMPATIBILITY[recipientGroup] || [recipientGroup];
  }
  return RED_CELL_COMPATIBILITY[recipientGroup] || [recipientGroup];
}

/**
 * Centralized biological blood compatibility function
 * Returns true only if donor blood is biologically safe for recipient.
 */
export function isBloodCompatible(
  donorGroup?: string | null,
  recipientGroup?: string | null,
  component: BloodComponent = 'WHOLE_BLOOD'
): boolean {
  if (!donorGroup || !recipientGroup) return false;
  const compatibleDonors = getCompatibleDonorBloodGroups(recipientGroup as BloodGroup, component);
  return compatibleDonors.includes(donorGroup as BloodGroup);
}

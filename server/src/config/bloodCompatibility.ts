import { BloodGroup, BloodComponent } from '../types';

/**
 * Blood Group Compatibility Matrix
 * 
 * Defines compatible donor blood groups for a given recipient.
 * Separated by blood component:
 * - WHOLE_BLOOD / RED_CELLS: Based on red cell antigens.
 *   O- is universal donor; AB+ is universal recipient.
 * - PLASMA: Inverted ABO compatibility (based on antibodies in plasma).
 *   AB is universal plasma donor; O is universal plasma recipient.
 * - PLATELETS: ABO identical or compatible plasma preferred.
 */

// Red Blood Cells & Whole Blood Compatibility Matrix
// Key: Recipient Blood Group -> Array of Compatible Donor Blood Groups
const RED_CELL_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

// Plasma Compatibility Matrix
// Key: Recipient Blood Group -> Array of Compatible Donor Blood Groups
const PLASMA_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
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
 * Retrieve all compatible donor blood groups for a recipient based on blood component
 */
export function getCompatibleDonorBloodGroups(
  recipientGroup: BloodGroup,
  component: BloodComponent = 'WHOLE_BLOOD'
): BloodGroup[] {
  if (component === 'PLASMA') {
    return PLASMA_COMPATIBILITY[recipientGroup] || [recipientGroup];
  }
  // Default to Red Cell / Whole Blood rules for WHOLE_BLOOD, RED_CELLS, PLATELETS
  return RED_CELL_COMPATIBILITY[recipientGroup] || [recipientGroup];
}

/**
 * Check if a donor blood group is compatible with a recipient blood group
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

/**
 * Check if donor and recipient share the exact identical blood group
 */
export function isExactMatch(donorGroup: BloodGroup, recipientGroup: BloodGroup): boolean {
  return donorGroup === recipientGroup;
}

/**
 * Check if donor is universal donor for the requested component
 */
export function isUniversalDonor(donorGroup: BloodGroup, component: BloodComponent = 'WHOLE_BLOOD'): boolean {
  if (component === 'PLASMA') {
    return donorGroup === 'AB+' || donorGroup === 'AB-';
  }
  return donorGroup === 'O-';
}

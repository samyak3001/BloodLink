/**
 * BloodLink — Development Database Seed Script
 *
 * Populates realistic, fictional development data for:
 * - Admin, Hospital, and Donor accounts with hashed passwords
 * - Donor profiles with self-reported screening and geospatial coordinates
 * - Hospital profiles with medical license numbers and locations
 * - Emergency requests across multiple urgencies, components, and statuses
 * - Donation history records and verified donation certificates
 * - Real-time notifications (emergency alerts, donor responses, system updates)
 * - Security and compliance audit logs
 *
 * STRICT SAFETY RULE:
 * This script is strictly gated to development and test environments.
 * It will immediately abort if executed with NODE_ENV === 'production'.
 */

import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import {
  User,
  DonorProfile,
  HospitalProfile,
  EmergencyRequest,
  DonationHistory,
  Notification,
  AuditLog,
} from '../models';
import { hashPassword } from '../utils/password';
import { connectDB, disconnectDB } from '../config/database';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Validates that the current environment is safe for running seed operations.
 */
export function validateSeedEnvironment(): void {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') {
    throw new Error(
      'CRITICAL SECURITY ALERT: Database seed operation is strictly prohibited in production environment.'
    );
  }
}

/**
 * Standard Demo Credentials Catalog (Fictional development users)
 */
export const DEMO_CREDENTIALS = {
  admin: {
    name: 'System Administrator',
    email: 'admin@bloodlink.org',
    password: 'Password123!',
    role: 'ADMIN' as const,
    phone: '+1 (555) 019-9000',
  },
  adminAlt: {
    name: 'Platform Moderator',
    email: 'admin.test@example.com',
    password: 'Password123!',
    role: 'ADMIN' as const,
    phone: '+1 (555) 019-9001',
  },
  hospitalMetro: {
    name: 'Dr. Evelyn Vance (Chief of Surgery)',
    hospitalName: 'Metro General Emergency Hospital',
    email: 'metro.hospital@bloodlink.org',
    password: 'Password123!',
    role: 'HOSPITAL' as const,
    licenseNumber: 'HOSP-LIC-2026-001',
    emergencyHelpline: '+1 (555) 911-0101',
    phone: '+1 (555) 911-0100',
    coordinates: [-73.9851, 40.7484] as [number, number], // Midtown Manhattan area
    address: {
      street: '450 Lexington Ave',
      city: 'Metropolis',
      state: 'NY',
      postalCode: '10017',
    },
    isVerifiedByAdmin: true,
  },
  hospitalCityCare: {
    name: 'Dr. Arthur Pendelton (Trauma Director)',
    hospitalName: 'City Care Trauma Center',
    email: 'city.care@bloodlink.org',
    password: 'Password123!',
    role: 'HOSPITAL' as const,
    licenseNumber: 'HOSP-LIC-2026-002',
    emergencyHelpline: '+1 (555) 911-0202',
    phone: '+1 (555) 911-0200',
    coordinates: [-73.9680, 40.7648] as [number, number], // Upper East Side area (~2.5km away)
    address: {
      street: '1200 York Avenue',
      city: 'Metropolis',
      state: 'NY',
      postalCode: '10021',
    },
    isVerifiedByAdmin: true,
  },
  hospitalPending: {
    name: 'Dr. Clara Oswald (Medical Director)',
    hospitalName: 'St. Jude Community Clinic',
    email: 'hospital.test@example.com',
    password: 'Password123!',
    role: 'HOSPITAL' as const,
    licenseNumber: 'HOSP-LIC-2026-003',
    emergencyHelpline: '+1 (555) 911-0303',
    phone: '+1 (555) 911-0300',
    coordinates: [-73.9920, 40.7350] as [number, number], // Lower Manhattan area (~2km away)
    address: {
      street: '88 University Place',
      city: 'Metropolis',
      state: 'NY',
      postalCode: '10003',
    },
    isVerifiedByAdmin: false, // Pending verification for testing admin verification portal
  },
  donorAlex: {
    name: 'Alex Mercer (Universal Red Cell Donor)',
    email: 'alex.donor@example.com',
    password: 'Password123!',
    role: 'DONOR' as const,
    phone: '+1 (555) 012-3001',
    bloodGroup: 'O-' as const,
    supportedComponents: ['WHOLE_BLOOD', 'RED_CELLS'] as const,
    isAvailable: true,
    coordinates: [-73.9810, 40.7510] as [number, number], // ~0.5 km from Metro General
    city: 'Metropolis',
    district: 'Midtown',
    postalCode: '10016',
  },
  donorSarah: {
    name: 'Sarah Connor (Verified Donor)',
    email: 'sarah.donor@example.com',
    password: 'Password123!',
    role: 'DONOR' as const,
    phone: '+1 (555) 012-3002',
    bloodGroup: 'A+' as const,
    supportedComponents: ['WHOLE_BLOOD', 'PLATELETS', 'PLASMA'] as const,
    isAvailable: true,
    coordinates: [-73.9720, 40.7600] as [number, number], // ~1.8 km from Metro General
    city: 'Metropolis',
    district: 'Upper East',
    postalCode: '10022',
  },
  donorMichael: {
    name: 'Michael Chang (Resting Interval)',
    email: 'michael.donor@example.com',
    password: 'Password123!',
    role: 'DONOR' as const,
    phone: '+1 (555) 012-3003',
    bloodGroup: 'B+' as const,
    supportedComponents: ['WHOLE_BLOOD', 'RED_CELLS'] as const,
    isAvailable: false, // Temporarily resting
    coordinates: [-73.9950, 40.7420] as [number, number], // ~1.3 km away
    city: 'Metropolis',
    district: 'Chelsea',
    postalCode: '10011',
  },
  donorPriya: {
    name: 'Priya Sharma (Universal Plasma Donor)',
    email: 'priya.donor@example.com',
    password: 'Password123!',
    role: 'DONOR' as const,
    phone: '+1 (555) 012-3004',
    bloodGroup: 'AB+' as const,
    supportedComponents: ['WHOLE_BLOOD', 'PLASMA', 'PLATELETS'] as const,
    isAvailable: true,
    coordinates: [-73.9780, 40.7450] as [number, number], // ~0.8 km away
    city: 'Metropolis',
    district: 'Murray Hill',
    postalCode: '10016',
  },
  donorTest: {
    name: 'Johnathan Test (Demo Donor)',
    email: 'donor.test@example.com',
    password: 'Password123!',
    role: 'DONOR' as const,
    phone: '+1 (555) 012-3005',
    bloodGroup: 'O+' as const,
    supportedComponents: ['WHOLE_BLOOD', 'RED_CELLS', 'PLATELETS'] as const,
    isAvailable: true,
    coordinates: [-73.9870, 40.7495] as [number, number], // ~0.2 km away
    city: 'Metropolis',
    district: 'Herald Square',
    postalCode: '10001',
  },
};

/**
 * Main database seed procedure
 */
export async function seedDatabase(): Promise<{
  usersCount: number;
  donorsCount: number;
  hospitalsCount: number;
  requestsCount: number;
  historyCount: number;
  notificationsCount: number;
  auditLogsCount: number;
}> {
  validateSeedEnvironment();

  console.log('[Seed] Starting BloodLink development database seeding...');

  // Ensure DB connection
  await connectDB();

  // 1. Clean existing collections in development
  console.log('[Seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    DonorProfile.deleteMany({}),
    HospitalProfile.deleteMany({}),
    EmergencyRequest.deleteMany({}),
    DonationHistory.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  // 2. Hash shared passwords
  const defaultPasswordHash = await hashPassword('Password123!');

  // 3. Create Admin Users
  console.log('[Seed] Creating administrators...');
  const adminUsers = await User.create([
    {
      name: DEMO_CREDENTIALS.admin.name,
      email: DEMO_CREDENTIALS.admin.email,
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      phone: DEMO_CREDENTIALS.admin.phone,
      isVerified: true,
      status: 'ACTIVE',
    },
    {
      name: DEMO_CREDENTIALS.adminAlt.name,
      email: DEMO_CREDENTIALS.adminAlt.email,
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      phone: DEMO_CREDENTIALS.adminAlt.phone,
      isVerified: true,
      status: 'ACTIVE',
    },
  ]);

  // 4. Create Hospitals & Profiles
  console.log('[Seed] Creating hospital facilities...');
  const hospitalDataList = [
    DEMO_CREDENTIALS.hospitalMetro,
    DEMO_CREDENTIALS.hospitalCityCare,
    DEMO_CREDENTIALS.hospitalPending,
  ];

  const createdHospitalProfiles = [];
  const createdHospitalUsers = [];

  for (const h of hospitalDataList) {
    const user = await User.create({
      name: h.name,
      email: h.email,
      passwordHash: defaultPasswordHash,
      role: 'HOSPITAL',
      phone: h.phone,
      isVerified: h.isVerifiedByAdmin,
      status: 'ACTIVE',
    });
    createdHospitalUsers.push(user);

    const profile = await HospitalProfile.create({
      userId: user._id,
      hospitalName: h.hospitalName,
      licenseNumber: h.licenseNumber,
      emergencyHelpline: h.emergencyHelpline,
      isVerifiedByAdmin: h.isVerifiedByAdmin,
      location: {
        type: 'Point',
        coordinates: h.coordinates,
      },
      address: h.address,
    });
    createdHospitalProfiles.push(profile);
  }

  // 5. Create Donors & Profiles
  console.log('[Seed] Creating voluntary blood donors...');
  const donorDataList = [
    DEMO_CREDENTIALS.donorAlex,
    DEMO_CREDENTIALS.donorSarah,
    DEMO_CREDENTIALS.donorMichael,
    DEMO_CREDENTIALS.donorPriya,
    DEMO_CREDENTIALS.donorTest,
  ];

  const createdDonorProfiles = [];
  const createdDonorUsers = [];

  for (const d of donorDataList) {
    const user = await User.create({
      name: d.name,
      email: d.email,
      passwordHash: defaultPasswordHash,
      role: 'DONOR',
      phone: d.phone,
      isVerified: true,
      status: 'ACTIVE',
    });
    createdDonorUsers.push(user);

    const profile = await DonorProfile.create({
      userId: user._id,
      bloodGroup: d.bloodGroup,
      supportedComponents: [...d.supportedComponents],
      isAvailable: d.isAvailable,
      selfReportedScreening: {
        isAgeEligible: true,
        isWeightEligible: true,
        hasNoRecentIllness: true,
        hasValidInterval: d.isAvailable,
        screeningDisclaimerAcknowledged: true,
        lastScreeningDate: new Date(),
      },
      lastDonationDate: d.isAvailable
        ? new Date(Date.now() - 95 * 24 * 60 * 60 * 1000) // 95 days ago
        : new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (resting)
      location: {
        type: 'Point',
        coordinates: d.coordinates,
      },
      address: {
        city: d.city,
        district: d.district,
        postalCode: d.postalCode,
      },
      privacySettings: {
        hideExactLocation: true,
        showContactToMatchedHospitalsOnly: true,
      },
    });
    createdDonorProfiles.push(profile);
  }

  // 6. Create Realistic Emergency Requests
  console.log('[Seed] Creating emergency blood requests...');
  const metroHospitalProfile = createdHospitalProfiles[0];
  const cityCareProfile = createdHospitalProfiles[1];

  const alexDonorProfile = createdDonorProfiles[0]; // O-
  const sarahDonorProfile = createdDonorProfiles[1]; // A+
  const testDonorProfile = createdDonorProfiles[4]; // O+

  const requests = await EmergencyRequest.create([
    {
      hospitalId: metroHospitalProfile._id,
      patientIdentifier: 'EMERG-PT-2026-081',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 3,
      urgency: 'CRITICAL',
      status: 'ACTIVE',
      location: {
        type: 'Point',
        coordinates: metroHospitalProfile.location.coordinates,
      },
      requiredWithinHours: 2,
      potentialMatches: [
        {
          donorId: alexDonorProfile._id,
          status: 'NOTIFIED',
          matchScore: 98,
          distanceKm: 0.5,
          notifiedAt: new Date(Date.now() - 15 * 60 * 1000),
        },
      ],
      notes: 'Emergency polytrauma surgical admission. Immediate uncrossmatched O- negative units needed.',
    },
    {
      hospitalId: cityCareProfile._id,
      patientIdentifier: 'EMERG-PT-2026-082',
      bloodGroup: 'A+',
      bloodComponent: 'RED_CELLS',
      unitsRequired: 2,
      urgency: 'HIGH',
      status: 'MATCHED',
      location: {
        type: 'Point',
        coordinates: cityCareProfile.location.coordinates,
      },
      requiredWithinHours: 6,
      potentialMatches: [
        {
          donorId: sarahDonorProfile._id,
          status: 'ACCEPTED',
          matchScore: 94,
          distanceKm: 1.8,
          notifiedAt: new Date(Date.now() - 45 * 60 * 1000),
          respondedAt: new Date(Date.now() - 30 * 60 * 1000),
        },
        {
          donorId: testDonorProfile._id,
          status: 'NOTIFIED',
          matchScore: 82,
          distanceKm: 2.1,
          notifiedAt: new Date(Date.now() - 45 * 60 * 1000),
        },
      ],
      notes: 'Scheduled cardiothoracic emergency procedure. Concentrated red cell units required.',
    },
    {
      hospitalId: metroHospitalProfile._id,
      patientIdentifier: 'EMERG-PT-2026-079',
      bloodGroup: 'B+',
      bloodComponent: 'PLATELETS',
      unitsRequired: 4,
      urgency: 'MEDIUM',
      status: 'FULFILLED',
      location: {
        type: 'Point',
        coordinates: metroHospitalProfile.location.coordinates,
      },
      requiredWithinHours: 12,
      potentialMatches: [],
      notes: 'Oncology patient platelet replenishment completed successfully.',
    },
    {
      hospitalId: cityCareProfile._id,
      patientIdentifier: 'EMERG-PT-2026-074',
      bloodGroup: 'AB+',
      bloodComponent: 'PLASMA',
      unitsRequired: 2,
      urgency: 'CRITICAL',
      status: 'CANCELLED',
      location: {
        type: 'Point',
        coordinates: cityCareProfile.location.coordinates,
      },
      requiredWithinHours: 4,
      potentialMatches: [],
      notes: 'Patient stabilized via alternative clinical intervention. Request cancelled.',
    },
  ]);

  // 7. Create Historical Verified Donation Records
  console.log('[Seed] Creating donation history ledger...');
  const donationRecords = await DonationHistory.create([
    {
      donorId: alexDonorProfile._id,
      hospitalId: metroHospitalProfile._id,
      requestId: requests[2]._id,
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsDonated: 1,
      status: 'COMPLETED',
      donationDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
      certificateId: 'CERT-2026-DON-8819',
      verificationNotes: 'Voluntary whole blood donation completed. Donor rested and vital signs normal.',
    },
    {
      donorId: sarahDonorProfile._id,
      hospitalId: cityCareProfile._id,
      requestId: requests[2]._id,
      bloodGroup: 'A+',
      bloodComponent: 'PLATELETS',
      unitsDonated: 2,
      status: 'COMPLETED',
      donationDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      certificateId: 'CERT-2026-DON-8820',
      verificationNotes: 'Apheresis platelet donation secured. Hemoglobin verified at 13.8 g/dL.',
    },
  ]);

  // 8. Create In-App Notifications
  console.log('[Seed] Creating notifications...');
  const notifications = await Notification.create([
    {
      recipientId: createdDonorUsers[0]._id, // Alex (Donor)
      type: 'EMERGENCY_ALERT',
      title: '🚨 CRITICAL O- Blood Emergency Nearby',
      message: 'Metro General Emergency Hospital has requested 3 units of O- blood within 2 hours. You are ~0.5 km away.',
      data: {
        requestId: requests[0]._id.toString(),
        bloodGroup: 'O-',
        urgency: 'CRITICAL',
        distanceKm: 0.5,
      },
      isRead: false,
    },
    {
      recipientId: createdHospitalUsers[1]._id, // City Care (Hospital)
      type: 'DONOR_ACCEPTED',
      title: 'Donor Accepted Emergency Request',
      message: 'Sarah Connor (A+) accepted emergency request EMERG-PT-2026-082. Transit time is estimated at ~10 mins.',
      data: {
        requestId: requests[1]._id.toString(),
        donorId: sarahDonorProfile._id.toString(),
      },
      isRead: false,
    },
    {
      recipientId: createdDonorUsers[1]._id, // Sarah (Donor)
      type: 'STATUS_UPDATE',
      title: 'Donation Completed & Verified',
      message: 'City Care Trauma Center has verified your donation. Certificate CERT-2026-DON-8820 is ready.',
      data: {
        certificateId: 'CERT-2026-DON-8820',
      },
      isRead: true,
    },
    {
      recipientId: adminUsers[0]._id, // Admin
      type: 'SYSTEM',
      title: 'New Hospital Awaiting License Review',
      message: 'St. Jude Community Clinic registered with license HOSP-LIC-2026-003 and awaits administrative verification.',
      data: {
        hospitalId: createdHospitalProfiles[2]._id.toString(),
      },
      isRead: false,
    },
  ]);

  // 9. Create Audit Logs
  console.log('[Seed] Creating security audit logs...');
  const auditLogs = await AuditLog.create([
    {
      actorId: adminUsers[0]._id,
      action: 'HOSPITAL_LICENSE_VERIFIED',
      resource: 'HospitalProfile',
      resourceId: metroHospitalProfile._id.toString(),
      details: {
        licenseNumber: 'HOSP-LIC-2026-001',
        facilityName: 'Metro General Emergency Hospital',
        verifiedBy: 'System Administrator',
      },
      ipAddress: '127.0.0.1',
    },
    {
      actorId: createdHospitalUsers[0]._id,
      action: 'EMERGENCY_REQUEST_PUBLISHED',
      resource: 'EmergencyRequest',
      resourceId: requests[0]._id.toString(),
      details: {
        bloodGroup: 'O-',
        urgency: 'CRITICAL',
        units: 3,
        notifiedDonorsCount: 1,
      },
      ipAddress: '127.0.0.1',
    },
    {
      actorId: createdDonorUsers[1]._id,
      action: 'DONOR_REQUEST_ACCEPTED',
      resource: 'EmergencyRequest',
      resourceId: requests[1]._id.toString(),
      details: {
        bloodGroup: 'A+',
        distanceKm: 1.8,
      },
      ipAddress: '127.0.0.1',
    },
  ]);

  const summary = {
    usersCount: adminUsers.length + createdHospitalUsers.length + createdDonorUsers.length,
    donorsCount: createdDonorProfiles.length,
    hospitalsCount: createdHospitalProfiles.length,
    requestsCount: requests.length,
    historyCount: donationRecords.length,
    notificationsCount: notifications.length,
    auditLogsCount: auditLogs.length,
  };

  console.log('\n===========================================================');
  console.log('BLOODLINK DATABASE SEED COMPLETED SUCCESSFULLY');
  console.log('===========================================================');
  console.log(`Users Created:         ${summary.usersCount}`);
  console.log(`Donors Created:        ${summary.donorsCount}`);
  console.log(`Hospitals Created:     ${summary.hospitalsCount}`);
  console.log(`Requests Created:      ${summary.requestsCount}`);
  console.log(`Donations Recorded:    ${summary.historyCount}`);
  console.log(`Notifications Created: ${summary.notificationsCount}`);
  console.log(`Audit Logs Recorded:   ${summary.auditLogsCount}`);
  console.log('-----------------------------------------------------------');
  console.log('DEMO ACCOUNTS READY:');
  console.log('  Donor (O-):          alex.donor@example.com       / Password123!');
  console.log('  Donor (A+):          sarah.donor@example.com      / Password123!');
  console.log('  Donor (Demo O+):     donor.test@example.com       / Password123!');
  console.log('  Hospital (Verified): metro.hospital@bloodlink.org / Password123!');
  console.log('  Hospital (Pending):  hospital.test@example.com    / Password123!');
  console.log('  Admin:               admin@bloodlink.org          / Password123!');
  console.log('  Admin (Demo):        admin.test@example.com       / Password123!');
  console.log('===========================================================\n');

  return summary;
}

// Execute standalone if called directly
if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Error] Database seeding failed:', err);
      await disconnectDB();
      process.exit(1);
    });
}

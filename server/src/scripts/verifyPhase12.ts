/**
 * Phase 12 Verification Script: Analytics Visualizations, Complete Views & Final Polish
 *
 * Verifies all Phase 12 deliverables:
 * 1. Interactive Dashboard Visualizations:
 *    - DashboardCharts.tsx component module
 *    - EmergencyTrendsChart (stacked bars with urgency breakdown)
 *    - DonorActivityChart (ABO/Rh availability & response speed)
 *    - FulfillmentRateChart (radial progress, outcomes breakdown)
 *    - AdminDashboardPage integration
 *    - HospitalDashboardPage integration
 * 2. Missing Views:
 *    - HowItWorksPage.tsx (/how-it-works public route)
 *    - HospitalNotificationsPage.tsx (/hospital/notifications)
 *    - AdminRequestsPage.tsx (/admin/requests)
 * 3. Navigation & RBAC Route Registry:
 *    - AppRoutes.tsx routing configuration
 *    - Sidebar.tsx role-based navigation entries
 *    - Navbar.tsx public navigation
 *    - LandingPage.tsx integration
 * 4. Accessibility & UI Polish:
 *    - index.css focus-visible high-contrast rings
 *    - index.css prefers-reduced-motion media query
 *    - ARIA attributes on interactive charts and data tables
 */

import fs from 'fs';
import path from 'path';

async function runPhase12Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 12 VERIFICATION: Analytics & Final Polish');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  }

  const clientDir = path.join(__dirname, '../../../client/src');

  // -----------------------------------------------------------------
  // 1. Interactive Dashboard Visualizations
  // -----------------------------------------------------------------
  console.log('--- 1. Responsive Interactive Dashboard Charts ---');

  const chartsPath = path.join(clientDir, 'components/domain/DashboardCharts.tsx');
  assert(fs.existsSync(chartsPath), 'client/src/components/domain/DashboardCharts.tsx exists');

  const chartsContent = fs.readFileSync(chartsPath, 'utf8');
  assert(chartsContent.includes('export const EmergencyTrendsChart'), 'Exports EmergencyTrendsChart');
  assert(chartsContent.includes('export const DonorActivityChart'), 'Exports DonorActivityChart');
  assert(chartsContent.includes('export const FulfillmentRateChart'), 'Exports FulfillmentRateChart');
  assert(chartsContent.includes('role="img"'), 'Charts provide semantic role="img" accessibility');
  assert(chartsContent.includes('aria-label='), 'Charts provide descriptive aria-label tags');

  // Integration in Dashboards
  const adminDashPath = path.join(clientDir, 'pages/admin/AdminDashboardPage.tsx');
  const adminDashContent = fs.readFileSync(adminDashPath, 'utf8');
  assert(adminDashContent.includes('<EmergencyTrendsChart'), 'AdminDashboardPage embeds EmergencyTrendsChart');
  assert(adminDashContent.includes('<DonorActivityChart'), 'AdminDashboardPage embeds DonorActivityChart');
  assert(adminDashContent.includes('<FulfillmentRateChart'), 'AdminDashboardPage embeds FulfillmentRateChart');

  const hospDashPath = path.join(clientDir, 'pages/hospital/HospitalDashboardPage.tsx');
  const hospDashContent = fs.readFileSync(hospDashPath, 'utf8');
  assert(hospDashContent.includes('<EmergencyTrendsChart'), 'HospitalDashboardPage embeds EmergencyTrendsChart');
  assert(hospDashContent.includes('<FulfillmentRateChart'), 'HospitalDashboardPage embeds FulfillmentRateChart');

  // -----------------------------------------------------------------
  // 2. Public "How BloodLink Works" Page
  // -----------------------------------------------------------------
  console.log('\n--- 2. Public How It Works Informational View ---');

  const howItWorksPath = path.join(clientDir, 'pages/public/HowItWorksPage.tsx');
  assert(fs.existsSync(howItWorksPath), 'client/src/pages/public/HowItWorksPage.tsx exists');

  const howItWorksContent = fs.readFileSync(howItWorksPath, 'utf8');
  assert(howItWorksContent.includes('Emergency Blood Request Creation'), 'Features Step 1: Emergency Request Creation');
  assert(howItWorksContent.includes('Smart Matching & Proximity Engine'), 'Features Step 2: Proximity & Matching');
  assert(howItWorksContent.includes('Instant Multi-Channel Alerts'), 'Features Step 3: Real-Time Alerts');
  assert(howItWorksContent.includes('Clinical Verification & Transfusion'), 'Features Step 4: Clinical Clearance');
  assert(howItWorksContent.includes('Crucial Medical Safety Principle'), 'Includes Prompt.md #41-50 medical safety disclaimer');
  assert(howItWorksContent.includes('compatibilityMatrix'), 'Includes interactive ABO/Rh biological compatibility table');
  assert(howItWorksContent.includes('Frequently Asked Questions'), 'Includes comprehensive FAQ accordions');
  assert(howItWorksContent.includes('Register as a Donor'), 'Includes call-to-action for donor registration');
  assert(howItWorksContent.includes('Register a Hospital'), 'Includes call-to-action for hospital facility registration');

  // -----------------------------------------------------------------
  // 3. Hospital Notifications View
  // -----------------------------------------------------------------
  console.log('\n--- 3. Hospital Notifications View ---');

  const hospNotifPath = path.join(clientDir, 'pages/hospital/HospitalNotificationsPage.tsx');
  assert(fs.existsSync(hospNotifPath), 'client/src/pages/hospital/HospitalNotificationsPage.tsx exists');

  const hospNotifContent = fs.readFileSync(hospNotifPath, 'utf8');
  assert(hospNotifContent.includes('useNotifications'), 'Connects to useNotifications hook');
  assert(hospNotifContent.includes('Donor Responses'), 'Provides dedicated Donor Responses filter tab');
  assert(hospNotifContent.includes('markAllAsRead'), 'Provides Mark All as Read button');
  assert(hospNotifContent.includes('NotificationItem'), 'Renders notifications via reusable NotificationItem');

  // -----------------------------------------------------------------
  // 4. Admin Emergency Requests Management
  // -----------------------------------------------------------------
  console.log('\n--- 4. Admin Emergency Requests Oversight ---');

  const adminReqPath = path.join(clientDir, 'pages/admin/AdminRequestsPage.tsx');
  assert(fs.existsSync(adminReqPath), 'client/src/pages/admin/AdminRequestsPage.tsx exists');

  const adminReqContent = fs.readFileSync(adminReqPath, 'utf8');
  assert(adminReqContent.includes('getEmergencyRequestsApi'), 'Fetches requests via getEmergencyRequestsApi');
  assert(adminReqContent.includes('selectedUrgency'), 'Provides clinical urgency filter');
  assert(adminReqContent.includes('selectedStatus'), 'Provides request lifecycle status filter');
  assert(adminReqContent.includes('selectedBloodGroup'), 'Provides ABO/Rh blood group filter');
  assert(adminReqContent.includes('searchTerm'), 'Provides text search by hospital or patient identifier');
  assert(adminReqContent.includes('setInspectingRequest'), 'Provides modal audit inspection for individual requests');
  assert(adminReqContent.includes('<Table>'), 'Renders responsive data table');

  // -----------------------------------------------------------------
  // 5. App Routing & Navigation Wiring
  // -----------------------------------------------------------------
  console.log('\n--- 5. Navigation & Route Registry ---');

  const routesPath = path.join(clientDir, 'routes/AppRoutes.tsx');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  assert(routesContent.includes('path="/how-it-works"'), 'AppRoutes registers /how-it-works public route');
  assert(routesContent.includes('path="/hospital/notifications"'), 'AppRoutes registers /hospital/notifications protected route');
  assert(routesContent.includes('path="/admin/requests"'), 'AppRoutes registers /admin/requests protected route');

  const sidebarPath = path.join(clientDir, 'components/layout/Sidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  assert(sidebarContent.includes("path: '/hospital/notifications'"), 'Sidebar provides link to /hospital/notifications for hospitals');
  assert(sidebarContent.includes("path: '/admin/requests'"), 'Sidebar provides link to /admin/requests for admins');

  const navbarPath = path.join(clientDir, 'components/layout/Navbar.tsx');
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');
  assert(navbarContent.includes("path: '/how-it-works'"), 'Navbar links to /how-it-works');

  const landingPath = path.join(clientDir, 'pages/public/LandingPage.tsx');
  const landingContent = fs.readFileSync(landingPath, 'utf8');
  assert(landingContent.includes('to="/how-it-works"'), 'LandingPage links to /how-it-works');

  // -----------------------------------------------------------------
  // 6. Accessibility & Design Tokens
  // -----------------------------------------------------------------
  console.log('\n--- 6. Accessibility & Design Consistency ---');

  const cssPath = path.join(clientDir, 'index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert(cssContent.includes(':focus-visible'), 'index.css defines high-contrast focus rings for keyboard navigation');
  assert(cssContent.includes('prefers-reduced-motion'), 'index.css respects prefers-reduced-motion preferences');
  assert(cssContent.includes('selection:bg-emergency-100'), 'Branded healthcare text selection colors configured');

  console.log('\n===========================================================');
  console.log(`PHASE 12 VERIFICATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('✅ All Phase 12 verification checks PASSED successfully!');
  }
}

runPhase12Verification().catch((err) => {
  console.error('Fatal error during Phase 12 verification:', err);
  process.exit(1);
});

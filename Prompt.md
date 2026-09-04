PROJECT: BLOODLINK
REAL-TIME EMERGENCY BLOOD DONOR & HOSPITAL MATCHING PLATFORM

============================================================
MASTER ROLE
============================================================

1. You are the Lead Full-Stack Software Architect and Senior Product Engineer.
2. You are responsible for designing and implementing the complete BloodLink platform.
3. Treat this as a production-quality portfolio project, not a simple college CRUD application.
4. The final application must look and feel like a premium modern SaaS product.
5. The application must be responsive across desktop, tablet, and mobile.
6. Every major feature must actually work.
7. Do not create fake buttons that do nothing.
8. Do not leave important functionality as TODO comments.
9. Do not use static mock screens when real functionality can be implemented.
10. Build the project systematically instead of generating random files.
11. Before modifying the project, inspect the existing repository.
12. Understand the current folder structure.
13. Identify the existing framework and dependencies.
14. Reuse existing working infrastructure where appropriate.
15. Do not unnecessarily replace working technologies.
16. If the repository is empty, initialize a professional full-stack architecture.
17. Keep the code modular.
18. Keep the code maintainable.
19. Keep the code strongly typed wherever possible.
20. Follow production-level coding standards.

============================================================
PRODUCT VISION
============================================================

21. BloodLink connects blood donors, hospitals, and blood recipients.
22. The platform helps hospitals find potentially eligible nearby donors during emergencies.
23. Hospitals can create emergency blood requests.
24. Donors can receive real-time emergency alerts.
25. The system can match requests using blood group compatibility.
26. The system can prioritize donors based on distance.
27. The system can consider donor availability.
28. The system can consider donor eligibility information.
29. The system can track request status in real time.
30. Hospitals can manage their active emergency requests.
31. Donors can manage their availability.
32. Administrators can monitor platform activity.
33. The application should communicate urgency without creating unnecessary panic.
34. The interface should feel trustworthy.
35. The interface should feel professional.
36. The interface should feel medically appropriate.
37. The interface should feel modern and premium.
38. Do not make the interface look like a generic hospital template.
39. Avoid outdated gradients and excessive visual effects.
40. Prioritize clarity, accessibility, and information hierarchy.

============================================================
IMPORTANT MEDICAL SAFETY PRINCIPLE
============================================================

41. This platform is a coordination and matching system.
42. It is not a medical diagnosis system.
43. It must not make medical diagnoses.
44. It must not claim that a donor is medically fit solely from user-entered data.
45. Clearly distinguish "potentially eligible" from "medically cleared."
46. Final donor eligibility must be verified by authorized medical personnel.
47. Display appropriate eligibility disclaimers where required.
48. Never present algorithmic matching as medical approval.
49. Never expose unnecessary sensitive medical information.
50. Design the application around privacy and responsible data handling.

============================================================
TEAM ROLES
============================================================

51. Act simultaneously as a Senior Product Manager.
52. Act as a Senior UI/UX Designer.
53. Act as a Frontend Architect.
54. Act as a Backend Architect.
55. Act as a Database Architect.
56. Act as a Realtime Systems Engineer.
57. Act as an Authentication and Security Engineer.
58. Act as a QA Engineer.
59. Act as a DevOps Engineer.
60. Act as a Performance Engineer.
61. Act as an Accessibility Engineer.
62. Act as a Code Reviewer.
63. Act as a Technical Writer.
64. Before implementation, create a clear technical plan.
65. Break the work into logical milestones.
66. Implement milestone by milestone.
67. After each milestone, verify the implementation.
68. Fix errors before proceeding.
69. Do not blindly continue when compilation errors exist.
70. Do not hide errors with unsafe workarounds.

============================================================
RECOMMENDED TECHNOLOGY STACK
============================================================

71. Prefer React with TypeScript for the frontend.
72. Prefer Vite for frontend development if appropriate.
73. Prefer Node.js with Express and TypeScript for the backend.
74. Prefer MongoDB for the primary database.
75. Prefer Mongoose for MongoDB modeling.
76. Use Socket.IO for real-time communication where appropriate.
77. Use Tailwind CSS for styling.
78. Use a high-quality component system such as shadcn/ui where appropriate.
79. Use Lucide icons or another consistent icon library.
80. Use React Router for routing.
81. Use TanStack Query for server state where appropriate.
82. Use React Hook Form for complex forms.
83. Use Zod for validation.
84. Use JWT-based authentication or a secure session architecture.
85. Store secrets only in environment variables.
86. Never hardcode API keys.
87. Never hardcode database credentials.
88. Never commit .env files.
89. Create a .env.example file.
90. Document required environment variables.

============================================================
APPLICATION ARCHITECTURE
============================================================

91. Use a clean separation between frontend and backend.
92. Organize the backend into routes, controllers, services, models, middleware, and utilities.
93. Keep business logic out of route handlers where practical.
94. Create reusable frontend components.
95. Create reusable API clients.
96. Create centralized error handling.
97. Create centralized authentication middleware.
98. Create centralized authorization middleware.
99. Create consistent API response structures.
100. Use appropriate HTTP status codes.
101. Validate incoming requests.
102. Sanitize user-controlled data.
103. Handle loading states.
104. Handle empty states.
105. Handle error states.
106. Handle network failures.
107. Handle unauthorized access.
108. Handle expired authentication.
109. Handle unavailable realtime connections.
110. Provide graceful fallback behavior.

============================================================
USER ROLES
============================================================

111. Implement role-based access control.
112. Primary roles should include DONOR.
113. Primary roles should include HOSPITAL.
114. Primary roles should include ADMIN.
115. Design authorization so additional roles can be added later.
116. Donors must only access donor functionality.
117. Hospitals must only access hospital functionality.
118. Admins must have administrative functionality.
119. Never rely only on frontend role checks.
120. Enforce authorization on the backend.

============================================================
LANDING PAGE
============================================================

121. Create a premium landing page.
122. Include a polished navigation bar.
123. Include BloodLink branding.
124. Include a strong hero section.
125. Clearly explain the platform's purpose.
126. Include prominent Donor and Hospital calls to action.
127. Include a real-time emergency visual concept.
128. Include trust indicators.
129. Include platform statistics using seeded/demo data where appropriate.
130. Include a "How BloodLink Works" section.
131. Include donor workflow.
132. Include hospital workflow.
133. Include emergency response workflow.
134. Include safety information.
135. Include FAQ section.
136. Include footer navigation.
137. Include responsive mobile navigation.
138. Include subtle animations.
139. Keep animations fast and purposeful.
140. Respect prefers-reduced-motion.

============================================================
VISUAL DESIGN SYSTEM
============================================================

141. Create a consistent design system.
142. Use a sophisticated healthcare-inspired visual language.
143. Use strong typography hierarchy.
144. Use generous spacing.
145. Use rounded cards appropriately.
146. Use subtle shadows.
147. Avoid excessive shadows.
148. Use clear status colors.
149. Ensure color contrast meets accessibility requirements.
150. Use semantic colors consistently.
151. Emergency status should be immediately recognizable.
152. Available donor status should be immediately recognizable.
153. Offline status should be obvious.
154. Pending status should be distinguishable.
155. Completed status should be distinguishable.
156. Use icons together with text where possible.
157. Do not communicate important information using color alone.
158. Create reusable badges.
159. Create reusable buttons.
160. Create reusable cards.
161. Create reusable dialogs.
162. Create reusable tables.
163. Create reusable form components.

============================================================
AUTHENTICATION
============================================================

164. Implement registration.
165. Implement login.
166. Implement logout.
167. Implement protected routes.
168. Implement role-based redirects.
169. Implement password hashing.
170. Never store plaintext passwords.
171. Implement authentication persistence.
172. Handle invalid credentials gracefully.
173. Handle expired sessions gracefully.
174. Add password reset architecture.
175. Add email verification architecture where practical.
176. Validate registration fields.
177. Validate passwords.
178. Prevent duplicate accounts.
179. Provide useful authentication error messages.
180. Do not reveal sensitive authentication details unnecessarily.

============================================================
DONOR EXPERIENCE
============================================================

181. Create a dedicated donor dashboard.
182. Show donor availability status.
183. Allow donor to switch availability.
184. Show donor blood group.
185. Show donor profile completion.
186. Show recent donation/request activity.
187. Show nearby emergency requests.
188. Show relevant emergency alerts.
189. Allow donor to accept an emergency request.
190. Allow donor to decline an emergency request.
191. Allow donor to view request details.
192. Allow donor to update profile.
193. Allow donor to manage location preferences.
194. Allow donor to manage notification preferences.
195. Allow donor to view donation history.
196. Allow donor to manage availability.
197. Include an eligibility information section.
198. Clearly state that self-reported eligibility is not medical clearance.
199. Allow donor to mark themselves temporarily unavailable.
200. Provide clear status feedback after every action.

============================================================
HOSPITAL EXPERIENCE
============================================================

201. Create a dedicated hospital dashboard.
202. Show active emergency requests.
203. Show pending donor responses.
204. Show accepted donor responses.
205. Show completed requests.
206. Show request statistics.
207. Allow hospitals to create blood requests.
208. Request fields should include blood group.
209. Request fields should include required units.
210. Request fields should include urgency.
211. Request fields should include location.
212. Request fields should include hospital details.
213. Request fields should include contact information.
214. Request fields should include expiration/required time where appropriate.
215. Validate every request field.
216. Allow hospitals to update request status.
217. Allow hospitals to cancel requests.
218. Allow hospitals to view matched donors.
219. Allow hospitals to view donor response status.
220. Do not expose unnecessary donor personal data.
221. Provide a safe contact workflow.
222. Show donor distance where location data is available.
223. Show donor availability.
224. Show matching blood group compatibility status.
225. Show whether eligibility verification is pending or completed.
226. Make emergency workflows extremely clear.

============================================================
EMERGENCY REQUEST SYSTEM
============================================================

227. Build a complete emergency request workflow.
228. A hospital creates an emergency request.
229. Validate the request.
230. Store the request in MongoDB.
231. Determine compatible donor groups.
232. Determine potentially eligible available donors.
233. Rank potential matches using configurable criteria.
234. Consider blood-group compatibility.
235. Consider donor availability.
236. Consider approximate geographic distance.
237. Consider response history where appropriate.
238. Never claim that ranking guarantees medical suitability.
239. Notify matching donors through realtime events.
240. Create persistent notifications as a fallback.
241. Track donor responses.
242. Track request status.
243. Update dashboards in realtime.
244. Prevent duplicate responses.
245. Prevent invalid state transitions.
246. Automatically expire requests when appropriate.
247. Notify relevant users when request status changes.

============================================================
REALTIME SYSTEM
============================================================

248. Implement Socket.IO or an equivalent realtime layer.
249. Create authenticated socket connections.
250. Create appropriate rooms.
251. Create donor-specific notification channels.
252. Create hospital-specific notification channels.
253. Broadcast relevant request updates.
254. Broadcast donor response updates.
255. Update dashboard counts without full page refresh.
256. Show connection status.
257. Handle reconnects.
258. Handle disconnected clients.
259. Avoid leaking events between users.
260. Authorize socket subscriptions.
261. Persist important notifications in the database.
262. Realtime functionality must not be the only source of truth.
263. Refreshing the page must preserve application state from the backend.

============================================================
MATCHING ENGINE
============================================================

264. Create a dedicated matching service.
265. Keep matching logic separate from controllers.
266. Define blood-group compatibility rules in one location.
267. Make matching rules configurable.
268. Match only against donors who are marked available.
269. Match based on supported blood groups.
270. Consider approximate distance.
271. Use a configurable radius.
272. Prioritize closer potential donors when appropriate.
273. Consider request urgency.
274. Consider donor response status.
275. Prevent already-engaged donors from receiving conflicting requests where appropriate.
276. Return explainable matching reasons.
277. Example reasons can include compatible blood group and nearby location.
278. Never expose internal scoring implementation unnecessarily.
279. Add unit tests for compatibility logic.
280. Add unit tests for ranking logic.

============================================================
LOCATION FEATURES
============================================================

281. Implement location-aware functionality.
282. Allow donors to provide their location.
283. Allow hospitals to provide their location.
284. Do not require exact location if approximate location is sufficient.
285. Minimize location data storage.
286. Use geospatial queries where supported.
287. Store coordinates using a suitable GeoJSON structure.
288. Add MongoDB geospatial indexing.
289. Implement nearby donor searching.
290. Allow configurable search radius.
291. Display distance in a human-readable format.
292. Integrate a map provider only through environment-configured credentials.
293. Do not hardcode map API keys.
294. Provide a fallback when maps are unavailable.
295. Do not expose precise donor location unnecessarily.
296. Prefer privacy-preserving approximate location display.

============================================================
NOTIFICATION CENTER
============================================================

297. Build a notification center.
298. Display unread notification count.
299. Support emergency request notifications.
300. Support request status notifications.
301. Support donor response notifications.
302. Support system notifications.
303. Allow notifications to be marked read.
304. Allow all notifications to be marked read.
305. Persist notifications.
306. Display notification timestamps.
307. Provide useful empty states.
308. Support realtime notification updates.
309. Add browser notification support where appropriate and permission is granted.
310. Never spam users with unnecessary notifications.

============================================================
ADMIN DASHBOARD
============================================================

311. Build a professional admin dashboard.
312. Show total donors.
313. Show active donors.
314. Show registered hospitals.
315. Show active emergency requests.
316. Show completed requests.
317. Show response rates.
318. Show system activity.
319. Show useful charts.
320. Add user management.
321. Add hospital management.
322. Add request management.
323. Add moderation tools.
324. Add audit log functionality.
325. Add system configuration areas where appropriate.
326. Protect admin routes.
327. Never expose admin APIs to unauthorized users.
328. Add confirmation dialogs for destructive actions.

============================================================
DATABASE DESIGN
============================================================

329. Create a User model.
330. Create a DonorProfile model.
331. Create a HospitalProfile model.
332. Create an EmergencyRequest model.
333. Create a DonationHistory model.
334. Create a Notification model.
335. Create an AuditLog model.
336. Create appropriate indexes.
337. Add timestamps.
338. Add validation.
339. Use references where appropriate.
340. Avoid excessive document duplication.
341. Avoid storing unnecessary sensitive information.
342. Design schemas for future scalability.
343. Add database seed scripts.
344. Create realistic development seed data.
345. Clearly label seed/demo records where appropriate.
346. Do not use fake data in a way that implies real medical activity.

============================================================
API DESIGN
============================================================

347. Create RESTful APIs.
348. Use clear endpoint naming.
349. Group endpoints by domain.
350. Implement authentication endpoints.
351. Implement donor endpoints.
352. Implement hospital endpoints.
353. Implement emergency request endpoints.
354. Implement matching endpoints.
355. Implement notification endpoints.
356. Implement admin endpoints.
357. Implement health-check endpoint.
358. Validate all request bodies.
359. Validate query parameters.
360. Validate route parameters.
361. Return consistent JSON responses.
362. Return useful error messages.
363. Never return passwords.
364. Never return password hashes.
365. Never return private information unnecessarily.

============================================================
SECURITY
============================================================

366. Implement secure password hashing.
367. Implement authentication middleware.
368. Implement authorization middleware.
369. Validate all user input.
370. Sanitize user input where necessary.
371. Configure CORS correctly.
372. Add rate limiting to sensitive endpoints.
373. Protect authentication endpoints from abuse.
374. Prevent unauthorized data access.
375. Prevent insecure direct object references.
376. Avoid leaking stack traces in production.
377. Use secure HTTP headers where appropriate.
378. Keep secrets in environment variables.
379. Add audit logging for sensitive admin actions.
380. Review all APIs for authorization vulnerabilities.
381. Do not expose sensitive donor information publicly.
382. Do not expose exact donor coordinates publicly.
383. Do not trust frontend-provided roles.
384. Verify permissions server-side.

============================================================
FORMS AND VALIDATION
============================================================

385. Build polished forms.
386. Use proper labels.
387. Use helpful validation messages.
388. Display field-level errors.
389. Disable submission during processing.
390. Prevent duplicate submissions.
391. Show success states.
392. Show error states.
393. Preserve valid form input after recoverable errors.
394. Validate both frontend and backend.
395. Never rely exclusively on frontend validation.

============================================================
SEARCH AND FILTERING
============================================================

396. Implement donor search where authorized.
397. Implement hospital search where appropriate.
398. Implement emergency request filtering.
399. Support blood-group filtering.
400. Support availability filtering.
401. Support urgency filtering.
402. Support status filtering.
403. Support location/radius filtering.
404. Debounce search inputs.
405. Implement pagination where appropriate.
406. Show result counts.
407. Provide clear empty states.
408. Provide reset-filter functionality.

============================================================
DASHBOARD UX
============================================================

409. Every dashboard must have a clear sidebar/navigation structure.
410. Include responsive navigation for mobile.
411. Include a top navigation/header.
412. Include user profile menu.
413. Include notification access.
414. Include breadcrumbs where useful.
415. Include page titles.
416. Include concise descriptions.
417. Use skeleton loading states.
418. Avoid blocking the entire UI unnecessarily.
419. Use optimistic updates only when safe.
420. Provide toast feedback for successful actions.
421. Provide clear error feedback.
422. Use confirmation dialogs for destructive operations.

============================================================
MOBILE RESPONSIVENESS
============================================================

423. Design mobile-first where practical.
424. Test widths around 320px.
425. Test widths around 375px.
426. Test widths around 768px.
427. Test desktop widths around 1024px.
428. Test large desktop widths around 1440px.
429. Tables must become usable on small screens.
430. Sidebars must collapse appropriately.
431. Forms must work comfortably on mobile.
432. Buttons must have touch-friendly sizing.
433. Modals must fit small screens.
434. Navigation must not overflow.
435. Cards must adapt to smaller widths.
436. Maps must remain usable on mobile.

============================================================
ACCESSIBILITY
============================================================

437. Use semantic HTML.
438. Provide accessible labels.
439. Support keyboard navigation.
440. Ensure focus states are visible.
441. Use appropriate ARIA attributes where necessary.
442. Maintain sufficient color contrast.
443. Do not rely only on color.
444. Ensure dialogs are accessible.
445. Ensure forms are accessible.
446. Ensure loading states are communicated appropriately.
447. Ensure interactive elements have meaningful names.

============================================================
ANIMATIONS
============================================================

448. Add tasteful micro-interactions.
449. Animate page transitions subtly.
450. Animate cards where appropriate.
451. Animate notification appearance.
452. Animate emergency status changes carefully.
453. Avoid excessive animations.
454. Avoid distracting motion.
455. Support reduced-motion preferences.
456. Keep animations performant.
457. Do not use animation merely for decoration.

============================================================
ERROR HANDLING
============================================================

458. Create a global frontend error strategy.
459. Create backend error middleware.
460. Handle 400 errors.
461. Handle 401 errors.
462. Handle 403 errors.
463. Handle 404 errors.
464. Handle 409 conflicts.
465. Handle 422 validation errors.
466. Handle 429 rate limits.
467. Handle 500 server errors.
468. Display user-friendly messages.
469. Log technical information appropriately.
470. Never expose sensitive server information.

============================================================
LOADING AND EMPTY STATES
============================================================

471. Every async page must have a loading state.
472. Use skeleton loaders where appropriate.
473. Every list must have an empty state.
474. Every search must have a no-results state.
475. Every error must have a recovery path where possible.
476. Avoid blank screens.
477. Avoid infinite loading indicators.
478. Show progress for long-running operations.

============================================================
DATA VISUALIZATION
============================================================

479. Add useful dashboard charts.
480. Use charts for trends rather than decoration.
481. Display emergency request trends.
482. Display donor activity trends.
483. Display request completion trends.
484. Display response rates.
485. Ensure charts are responsive.
486. Provide accessible labels.
487. Do not overwhelm the dashboard with charts.

============================================================
UI COMPONENT REQUIREMENTS
============================================================

488. Create reusable Button components.
489. Create reusable Input components.
490. Create reusable Select components.
491. Create reusable Modal components.
492. Create reusable Dialog components.
493. Create reusable Card components.
494. Create reusable Badge components.
495. Create reusable Table components.
496. Create reusable Toast components.
497. Create reusable Skeleton components.
498. Create reusable EmptyState components.
499. Create reusable ErrorState components.
500. Create reusable Status components.
501. Create reusable Map components where appropriate.
502. Create reusable DonorCard components.
503. Create reusable EmergencyRequestCard components.

============================================================
PROJECT PAGES
============================================================

504. Create Landing Page.
505. Create About/How It Works page.
506. Create Login page.
507. Create Registration page.
508. Create Forgot Password page.
509. Create Donor Dashboard.
510. Create Donor Profile.
511. Create Donor Requests page.
512. Create Donor Notifications page.
513. Create Donor Donation History page.
514. Create Hospital Dashboard.
515. Create Hospital Profile.
516. Create Create Emergency Request page.
517. Create Emergency Request Details page.
518. Create Matched Donors page.
519. Create Hospital Notifications page.
520. Create Admin Dashboard.
521. Create Admin Users page.
522. Create Admin Hospitals page.
523. Create Admin Requests page.
524. Create Admin Audit Logs page.
525. Create Settings page.
526. Create 404 page.

============================================================
DEMO EXPERIENCE
============================================================

527. Provide a development seed script.
528. Seed several donor accounts.
529. Seed several hospital accounts.
530. Seed emergency requests.
531. Seed notifications.
532. Seed realistic dashboard statistics.
533. Make demo credentials clearly documented.
534. Do not use real people's personal information.
535. Use obviously fictional demo data.
536. Make the demo easy to test.
537. Ensure every major workflow can be demonstrated.

============================================================
TESTING
============================================================

538. Write unit tests for important business logic.
539. Test blood-group compatibility.
540. Test matching ranking.
541. Test authorization.
542. Test validation.
543. Test emergency request state transitions.
544. Test notification creation.
545. Test duplicate response prevention.
546. Add API integration tests where practical.
547. Add frontend tests for critical components where practical.
548. Test mobile layouts.
549. Test desktop layouts.
550. Test authentication flows.
551. Test invalid authentication.
552. Test unauthorized access.
553. Test hospital request creation.
554. Test donor response.
555. Test realtime update behavior.
556. Fix all discovered errors.

============================================================
PERFORMANCE
============================================================

557. Avoid unnecessary API calls.
558. Use caching where appropriate.
559. Use pagination.
560. Optimize database queries.
561. Add appropriate database indexes.
562. Lazy-load heavy frontend pages.
563. Optimize images.
564. Avoid huge JavaScript bundles.
565. Avoid unnecessary rerenders.
566. Clean up socket listeners.
567. Avoid memory leaks.
568. Keep the dashboard responsive.

============================================================
DEVOPS
============================================================

569. Create a production-ready project structure.
570. Create environment configuration.
571. Create development scripts.
572. Create production build scripts.
573. Add linting.
574. Add formatting.
575. Add type checking.
576. Add test scripts.
577. Add database seed scripts.
578. Add README documentation.
579. Document local setup.
580. Document environment variables.
581. Document API architecture.
582. Document deployment steps.
583. Provide Docker support if appropriate.
584. Create a Dockerfile where useful.
585. Create docker-compose configuration if appropriate.
586. Ensure the application can be built successfully.

============================================================
GIT / CODE QUALITY
============================================================

587. Keep commits logically separable if Git is available.
588. Use meaningful file names.
589. Use meaningful variable names.
590. Avoid duplicated logic.
591. Avoid giant components.
592. Avoid giant controller files.
593. Avoid unnecessary abstractions.
594. Add comments only when they explain non-obvious logic.
595. Do not comment every line.
596. Remove dead code.
597. Remove unused imports.
598. Remove console debugging statements before production.
599. Keep TypeScript types accurate.
600. Avoid "any" unless genuinely necessary.
601. Review code after implementation.
602. Refactor obvious technical debt before finalizing.

============================================================
REALTIME UX DETAILS
============================================================

603. When a hospital creates an emergency request, update the hospital dashboard immediately.
604. When a donor receives a matching emergency request, display a notification.
605. When the donor accepts, update the hospital view.
606. When the donor declines, update the hospital view.
607. When a hospital changes request status, update relevant donor views.
608. Show realtime connection state.
609. Handle socket reconnection.
610. Do not duplicate notifications after reconnect.
611. Keep backend database state authoritative.
612. Refresh data when necessary after reconnect.

============================================================
EMERGENCY UX
============================================================

613. Emergency screens must prioritize the most important information.
614. Show blood group prominently.
615. Show required quantity clearly.
616. Show urgency clearly.
617. Show hospital identity clearly.
618. Show approximate location clearly.
619. Show request status clearly.
620. Make the primary action obvious.
621. Avoid unnecessary information on emergency cards.
622. Use confirmation before irreversible actions.
623. Provide clear feedback after accepting or declining.
624. Never create manipulative UI.
625. Never use misleading countdowns.
626. Never imply guaranteed donor availability.

============================================================
PRIVACY
============================================================

627. Minimize personally identifiable information.
628. Do not display donor information to unauthorized users.
629. Avoid exposing donor phone numbers publicly.
630. Avoid exposing exact donor coordinates.
631. Provide appropriate privacy settings.
632. Provide account deletion architecture.
633. Provide data export architecture where practical.
634. Log sensitive administrative operations.
635. Follow privacy-by-design principles.

============================================================
FINAL UI POLISH
============================================================

636. Perform a complete visual consistency pass.
637. Check typography.
638. Check spacing.
639. Check border radii.
640. Check button consistency.
641. Check icon consistency.
642. Check form consistency.
643. Check loading states.
644. Check empty states.
645. Check error states.
646. Check mobile responsiveness.
647. Check desktop responsiveness.
648. Check accessibility.
649. Check dark/light theme if implemented.
650. Ensure the entire application feels like one product.

============================================================
DO NOT DO THESE THINGS
============================================================

651. Do not create fake functionality.
652. Do not leave placeholder buttons.
653. Do not leave "Coming Soon" for core features.
654. Do not hardcode API responses for core functionality.
655. Do not hardcode authentication.
656. Do not hardcode user roles on the frontend.
657. Do not expose secrets.
658. Do not use real personal information.
659. Do not use random unrelated UI components.
660. Do not make every section a giant card.
661. Do not overuse gradients.
662. Do not overuse animations.
663. Do not create unnecessary pages.
664. Do not duplicate code.
665. Do not ignore backend errors.
666. Do not ignore TypeScript errors.
667. Do not ignore lint errors.
668. Do not ignore responsive issues.
669. Do not ignore accessibility issues.
670. Do not claim a feature works unless it has been tested.

============================================================
IMPLEMENTATION STRATEGY
============================================================

671. FIRST: inspect the repository.
672. SECOND: identify the existing stack.
673. THIRD: create an implementation plan.
674. FOURTH: establish the project architecture.
675. FIFTH: establish the design system.
676. SIXTH: implement database models.
677. SEVENTH: implement authentication.
678. EIGHTH: implement backend APIs.
679. NINTH: implement donor functionality.
680. TENTH: implement hospital functionality.
681. ELEVENTH: implement emergency request workflow.
682. TWELFTH: implement matching engine.
683. THIRTEENTH: implement realtime communication.
684. FOURTEENTH: implement notifications.
685. FIFTEENTH: implement admin dashboard.
686. SIXTEENTH: implement location functionality.
687. SEVENTEENTH: implement testing.
688. EIGHTEENTH: perform security review.
689. NINETEENTH: perform responsive UI review.
690. TWENTIETH: perform final production-readiness review.

============================================================
ANTIGRAVITY WORKING RULES
============================================================

691. Work directly inside the current project workspace.
692. Inspect files before creating replacements.
693. Do not overwrite working code unnecessarily.
694. When you encounter existing functionality, preserve it unless improvement is required.
695. Before adding a dependency, check whether an existing dependency already provides the required capability.
696. Prefer stable and well-maintained libraries.
697. Explain major architectural decisions in documentation.
698. After each major implementation step, run the appropriate checks.
699. Fix build errors immediately.
700. Fix runtime errors immediately.
701. Fix TypeScript errors immediately.
702. Fix lint errors immediately.
703. Test critical user flows after implementation.
704. Do not stop after creating the frontend.
705. Do not stop after creating the backend.
706. Connect frontend and backend completely.
707. Connect backend and database completely.
708. Connect realtime events completely.
709. Ensure authentication works end-to-end.
710. Ensure authorization works end-to-end.

============================================================
FINAL ACCEPTANCE CRITERIA
============================================================

711. The application must start successfully.
712. The frontend must build successfully.
713. The backend must start successfully.
714. Database connection must work.
715. Registration must work.
716. Login must work.
717. Logout must work.
718. Protected routes must work.
719. Donor dashboard must work.
720. Hospital dashboard must work.
721. Emergency request creation must work.
722. Matching must work.
723. Donor response must work.
724. Notifications must work.
725. Realtime updates must work.
726. Admin dashboard must work.
727. Search and filtering must work.
728. Location functionality must work where configured.
729. Responsive layouts must work.
730. Error handling must work.
731. Loading states must work.
732. Empty states must work.
733. Security controls must work.
734. Tests must pass.
735. Production build must succeed.
736. No critical console errors should remain.
737. No critical TypeScript errors should remain.
738. No critical lint errors should remain.
739. No hardcoded secrets should remain.
740. No core feature should be represented by a non-functional placeholder.

============================================================
FINAL DELIVERABLE
============================================================

741. Deliver a complete BloodLink full-stack web application.
742. The application must have a premium modern UI.
743. The application must be responsive.
744. The application must be accessible.
745. The application must be functional.
746. The application must have a real backend.
747. The application must have a real database.
748. The application must have authentication.
749. The application must have role-based authorization.
750. The application must have emergency blood request management.
751. The application must have donor matching.
752. The application must have realtime notifications.
753. The application must have location-aware functionality.
754. The application must have an admin dashboard.
755. The application must have validation and error handling.
756. The application must have tests.
757. The application must have documentation.
758. The application must be deployable.
759. The application must be impressive enough for a professional portfolio.
760. Most importantly, prioritize working functionality over visual mockups.

============================================================
START NOW
============================================================

761. Begin by inspecting the current workspace.
762. Do not immediately generate random code.
763. First determine what already exists.
764. Then provide a concise implementation plan.
765. Then begin implementation.
766. Work in logical milestones.
767. Verify each milestone before proceeding.
768. If a technical decision is ambiguous, choose the most maintainable production-oriented option.
769. Keep the user experience premium throughout development.
770. Build BloodLink as a serious full-stack engineering project.
771. Do not stop at a prototype-looking frontend.
772. Build the complete connected system.
773. At the end, perform a full application audit.
774. Report what was implemented.
775. Report what was tested.
776. Report any configuration required from the developer.
777. Report how to run the application locally.
778. Report how to build the application for production.
779. Report any external services that require API keys.
780. Do not declare the project complete until the critical workflows have been verified.
# Arabic and RTL QA Record

The application was audited with the `?lang=ar` preview override at a 375×812 mobile viewport for `/`, `/sign-in`, `/sign-up`, `/join-unit`, `/manager`, `/tenant`, `/technician`, and `/owner`. The landing, authentication, and unit-onboarding screens rendered Arabic copy, right-to-left alignment, readable cards, usable controls, and no visible horizontal overflow. The protected role routes correctly rendered Arabic loading or access-guard states for the unauthenticated browser session.

| Surface | Route | Result |
|---|---|---|
| Landing | `/?lang=ar` | Arabic copy and RTL layout visible; mobile header remains usable. |
| Sign in | `/sign-in?lang=ar` | Arabic heading, explanatory copy, CTA, and account link visible. |
| Sign up | `/sign-up?lang=ar` | Arabic account-creation copy and CTA visible. |
| Unit onboarding | `/join-unit?lang=ar` | Arabic six-digit guidance, input, CTA, and help text visible. |
| Manager guard | `/manager?lang=ar` | Arabic protected-route state visible. |
| Tenant guard | `/tenant?lang=ar` | Arabic protected-route state visible. |
| Technician guard | `/technician?lang=ar` | Arabic loading/guard state visible. |
| Owner guard | `/owner?lang=ar` | Arabic loading/guard state visible. |

A fully authenticated visual pass through manager, tenant, technician, and flat-owner data cards still depends on a logged-in role session. The route smoke confirms that language and direction are applied before authentication and that protected states remain localized; the application’s persisted language switcher remains the production path for authenticated portal QA.

The same eight routes were also captured at a 1280×720 desktop viewport. The Arabic landing screen showed correct RTL composition across the hero, feature card, navigation actions, and metrics. Sign-in, sign-up, and unit onboarding showed readable Arabic forms with correct right alignment. Manager route preview showed the Arabic dashboard shell, sidebar, header, filters, statistic cards, and protected-state behavior; tenant, technician, and owner routes showed the localized access guard because no authenticated role session was available in the visual sandbox.

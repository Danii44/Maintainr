# Live Role QA Notes

Date: 2026-08-17

The deployed `https://maintainr-demo.netlify.app` accepted the seeded Manager credentials and automatically routed to `/manager`, confirming shared sign-in and Manager role routing work in production.

The deployed Manager page showed the older UI: the public home page still displayed a separate `Manager administration` button, and the Manager portal still displayed `New ticket` and the unused slider-control button. These are absent or repaired in the current local project changes, so the deployed site has not yet received the latest checkpoint/build.

The live Manager portal loaded the seeded demo ticket `MT-1` and showed Manager navigation, account access, ticket filters, assignment, and priority controls. Authenticated Tenant, Technician, and Flat Owner live QA remains pending because the Manager session was signed out before those sessions were tested.

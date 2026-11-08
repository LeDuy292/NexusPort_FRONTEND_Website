# Shared Tiên Sa map

Edit `src/features/yard-design/geometry.js` and the existing source layout, then run
`node scripts/export-tien-sa-plan.mjs` from the frontend repository. The sibling
`NexusPort-App` and `NexusPort-Backend-Website` checkouts must be present.

The exporter writes the route graph to the backend, SVG and version to the app,
and a version manifest to the web. Ship matching versions together. Clients never
project a route from a different version onto this drawing.

This is a schematic design, not surveyed coordinates. Relative drawing lengths
choose a basic corridor; they do not provide metres, travel times, GPS positioning,
or congestion optimization. The backend suppresses distance and ETA for this plan.
Assigned destinations still come from existing operations/reservations; the export
does not create inventory slots or assign containers.

B/C use through aisles. A/E/F use two-way access and return to the same cross road.
There is no rear connector behind E/F because of the mountain boundary. Turning
requires yard staff instructions; this drawing does not certify turning clearances.
The two outer A aisles and the B04/E01 connector belong to the shared geometry.

Existing arrival, yard-completion, driver-confirmation and gate-out APIs remain
the journey state machine. Unknown destinations, expired maps and unresolved road
restrictions must not receive fabricated directions. Other gate/map configurations
retain the existing route provider.

The configured DB was migrated with user authorization: ordinary inventory/open
booking destinations use C, reefers and the existing plugs use D. The protected
map reads live footprints/occupancy; the DEV preview makes no inventory requests.
See the backend's `docs/yard-layout-map.md` for migration, backup and history details.

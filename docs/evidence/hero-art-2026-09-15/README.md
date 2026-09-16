# Homepage art direction - 15 September 2026

Owner request: the screenshot-led homepage lacked colour, artistic direction, uniqueness
and animation. The actual product views were explicitly acceptable and remain intact.
Branch: `codex/ui1-hero-art-direction`, based on `e4ac563`.

## Composition

A full-bleed, physically lit signal-ribbon artwork frames the live Enquiry wordmark,
customer-focused supporting copy and early-access CTA. Violet has coral and citron
counterpoints; dark aubergine anchors the type and primary action. The hero is not a card
or a split media layout. The actual app screenshots remain in a separate labelled product
preview below, preserving the three working view controls.

This is generated abstract brand artwork, never presented as a screenshot or shipped
product capability. There are no generated customers, fabricated product screens, metrics,
integrations or testimonials in the hero.

## Assets and generation

Generated using the built-in GPT image-generation tool, then lossily encoded to WebP with
the bundled Sharp utility. No new runtime package was added.

- `public/brand/signal-ribbon.webp`: 1942 x 809, 71,532 bytes.
- `public/brand/signal-ribbon-mobile.webp`: 900 x 1200, 41,406 bytes; a separately composed mobile variant, not a centre crop of the desktop image.
- Desktop generation source: `C:/Users/Adam/.codex/generated_images/01a089a4-58a2-7681-bcad-540b524a1490/exec-1c0f8539-f7c2-4af0-a742-2b24bb30ea36.png`.
- Mobile generation source: `C:/Users/Adam/.codex/generated_images/01a089a4-58a2-7681-bcad-540b524a1490/exec-a2cfdcc0-fa51-4b63-a30a-95b285964584.png`.

### Desktop prompt

Create a production-quality ultrawide 2.4:1 website hero BACKGROUND ART asset for Enquiry, a calm modern tool for small service business owners that turns changing customer enquiries into a clear next step. This is abstract brand art, NOT a screenshot, NOT a fake product mockup. Art direction: an ambitious September 2026 independent design studio campaign, tactile sculptural colour, extraordinarily elegant and memorable, bright and optimistic rather than corporate AI. A single continuous broad fluted ribbon made from satin-finish violet lacquered metal: several finely ribbed strands converge into one beautifully controlled sweeping path. Close-up sculptural photography / exquisite physically lit CGI with realistic material detail. The violet path sweeps in from the lower LEFT edge and curls away around the upper RIGHT edge, framing a very spacious clear central area, with small intentional accents of coral-red and fresh acidic yellow-green on the ribbon's edge/underside. A pale cool almost-white lilac studio environment with real soft directional shadows, restrained material highlights, sharp intentional composition. The central 55 percent of the image must be calm and near-white, completely empty for large dark typography that will be implemented in HTML. Let the sculptural ribbon be large, confidently cropped by the outer image edges, NOT little objects sprinkled around. No text, no letters, no logo, no envelopes, no mail, no paper, no desk, no people, no phones, no dashboards, no UI, no cards, no stars, no magic symbols, no sparkles, no spheres or orbs, no bokeh, no fog, no rainbow or AI gradients. The subject is the beautiful physical continuous signal ribbon itself. Give it real artistic tension, impeccable finish, strong confident silhouette and generous negative space. It must remain beautiful as a full-bleed desktop hero behind live web typography.

### Mobile adaptation prompt

Adapt this exact Enquiry signal-ribbon brand artwork for a tall MOBILE website hero background, portrait 3:4 aspect ratio. Preserve the sophisticated satin violet metal ribbons with coral and acidic citron edges, real material, ribbing, physical lighting and very pale near-white lilac environment. Recompose, do not just crop. A strong violet ribbon with visible coral underside and small citron edge curves into the UPPER RIGHT CORNER, occupying only the top 15% and outer right 12%. Another low arc sweeps across the BOTTOM 15%, with a coral/citron finish visibly present at the lower left. Keep the entire CENTRAL region from 18% to 82% height mostly clear, pale near-white negative space for large DARK HTML typography and buttons. This is abstract brand art, no product UI, no fake screenshot. No text or letters, no logo, no envelopes, no paper, no people, no orbs, no stars, no glow, no blur, no gradient blobs. Make the composition equally strong and recognisable on a narrow phone. The ribbons should frame, not intrude on the centre.

## Motion and verification

The bitmap has slow CSS transform motion; it is not described as a live 3D simulation.
There is no per-frame JavaScript. Motion defaults paused before hydration, respects reduced
motion and has a keyboard-accessible play/pause control. Intersection visibility suspends
animation when less than 15 percent of the hero is visible. Forced colours remove the art.
The copy and CTA do not move, and product tabs do not auto-advance.

Visual inspection covers 1920x1080, 1280x720, 768x1024, 390x844, 320x568 and 844x390.
The next section remains visible at every checked size, with no document overflow.
Landscape has a lower-contrast artwork treatment to keep the copy readable. Keyboard Space
pauses the animation with visible focus; play resumes it. Clicking A closer look navigates
to the real product preview and suspends the hero animation. Today and Business selectors
were exercised and loaded their real product captures. Motion uses computed animation state
verification; an OS-level reduced-motion emulation is not claimed.

The first full run passed 773 of 775 tests: one assertion still referenced the replaced
background colour, and one unrelated database test failed during PGlite initialisation.
The colour assertion was updated to the shipped surface (without relaxing AA), a hero
contrast check was added, and the database case passed when rerun separately. Final complete
rerun, build and release results are recorded on the delivery PR.

Verification screenshots are recorded alongside this note. This visual change does not verify personal-email authentication,
production tenant workflows or close external beta/SMTP/contact readiness gates.

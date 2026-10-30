# Development and strength model · playable research-informed alpha

This is a **fictional management simulation**, not a medical model, genetic-potential estimate, coaching prescription, or validated race predictor. Qualitative relationships can be evidence-informed while the equations implementing them remain invented. All numerical development coefficients below are gameplay choices, not extracted physiological constants.

## What a 100% start means

Every new profile starts with 100% **personal remaining potential**, independently of starting age, FTP, VO2, pace or experience. Current sport conditioning still starts at the game's index of 18; the entered FTP/VO2/threshold paces establish that athlete's independent baseline. Thus 100% does not promise the same absolute performance for every athlete, guarantee elite ability, or grant immediate race durability.

Temporary exhaustion, available fuel, endurance CTL/ATL, local muscle fatigue, current conditioning, and long-term potential are separate state variables. Potential affects actual positive adaptation and the upper performance multipliers; it is not merely a dashboard decoration.

## Principle → implementation

| Principle / source IDs in SOURCE_COVERAGE.md | Implemented abstraction | Boundary |
|---|---|---|
| Stimulus, recovery, individuality, specificity and reversibility · 021, 025, 026, 116 | Completed work, sport-specific durability, fatigue-limited quality, detraining, age/experience modifiers | Not a personalized physiological prediction; adults 18–85 at creation only |
| Load monitoring · 031, 034, 037, 040 | Endurance CTL/ATL/Form plus separate session-RPE summaries | TSS is estimated; not official run/swim algorithms or injury diagnosis |
| Masters recovery / Friel public guidance · 026 | Age-sensitive muscle recovery and simulated injury healing; preparation before demanding gym work | No birthday cliff or automatic injury from age; older athletes can still improve |
| Useful force and economy · 062, 064, 109, 110, 111 | Regional strength contributes modestly to FTP/pace economy and tissue tolerance | No guaranteed direct VO2 boost; injury immunity is impossible |
| Concurrent training · 064 and Schumann et al. | Optional gym after endurance; same-block hard endurance attenuates explosive-emphasis gains | No universal cancellation of strength/hypertrophy by endurance; 6 hours is a game choice, not a prescribed threshold |
| Novel loading / delayed soreness · 109, 114 | Local fatigue immediately; a separate pending soreness component arrives next day | One-day resolution, no set-by-set eccentric damage model |
| Body composition · 062, 081 | Explicit starting muscle estimate, small emphasis-dependent gains and slow detraining; modelled total mass enters W/kg and cycling physics | No fat-loss, calorie-balance, DXA or biopsy simulation; non-muscle mass stays fixed |
| Fatigue resistance · 042, 103 | Oxidative and fast-fibre endurance indices modestly affect session capacity | Indices are not percentages of Type I, IIa or IIx fibres |
| Taper and periodization · 027, 113, 116 | Manual training/recovery trade-offs affect freshness and conditioning | A full calendar and taper optimizer remain deferred |

Public guidance used: [Friel on customizing the base period](https://joefrieltraining.com/aging-customizing-the-base-period/) and [suggestions for ageing athletes](https://joefrieltraining.com/suggestions-for-the-aging-athlete/). These support individual preparation and recovery, not the game's numerical age curve. The [fifth-edition book listing](https://joefrieltraining.com/book/the-triathletes-training-bible-5th-ed/) confirms the edition; the full Kindle text was **not accessed**.

The [concurrent-training systematic review](https://pubmed.ncbi.nlm.nih.gov/34757594/) supports distinguishing explosive strength from maximal strength and hypertrophy when considering interference. It does not validate our 0.65 gain multiplier.

## Explicit game assumptions

Source of truth: `public/development.js`; physiology integration: `public/core.js`; daily orchestration and injuries: `public/engine.js`.

- Age advances by elapsed game days / 365.25. A gentle post-40 age ceiling is relative to age at career start, so an older new athlete still starts at 100%. This is a design convention, not a claim about the age of athletic peak.
- Recovery debt rises 1.5 points only on days with completed work and high exhaustion/overreach plus neglected support, or exceptionally high prior exhaustion. Otherwise it decays. Requested-but-blocked minutes never count as exposure.
- Potential loss starts only above 14 debt points and with actual work plus stress. Loss scales with age, current conditioning, experience and current potential. Good support with debt below 8 permits slow restoration, bounded by the age ceiling. Potential is bounded to 50–100 for playability. None of these thresholds diagnoses overtraining syndrome or irreversible damage.
- Positive conditioning gains scale with potential, age recovery and accumulated training experience; ordinary detraining remains separate. Seeded traits still contribute. A single neglected workout does not remove potential; injury and fatigue can nevertheless occur immediately.
- Performance caps are baseline multipliers: up to 1.20 for VO2, 1.35 for FTP and 1.30 for threshold-speed factors, with their headroom scaled by potential. These are game limits, not promised attainable improvements. Relative VO2 also reflects modelled mass.
- Gym modes: foundation, maximum-strength emphasis, explosive emphasis, hypertrophy and trunk control. Upper/lower/trunk targets determine regional gains and fatigue. These are abstractions, not exercise prescriptions.
- Gym technique begins from declared experience. Below skill 20, heavy/explosive requests become foundation work. Actual duration is limited by technique and muscle fatigue. Choosing failure adds fatigue and strain without granting automatic extra gains.
- Strength-load AU = completed gym minutes × simulated gym RPE. Separate 42/7-day averages use the same arithmetic smoothing as the endurance chart, but **are not TrainingPeaks CTL/ATL or validated strength fitness**. Their balance is shown separately. They must never be added to endurance TSS.
- Whole-body readiness combines global exhaustion, fuel, local muscle fatigue and soreness. Positive endurance Form therefore cannot guarantee fresh legs. Gym affects later capacity and race forecasts even on gym-only days.
- Muscle gains are tiny and bounded to 8% above the starting estimate; rates differ by emphasis. Neural/force adaptation is represented by regional strength indices, not measured motor-unit recruitment. Strength's contribution to tissue tolerance is capped at 10%, and high loading can still trigger an injury.
- Gym runs after endurance in the combined-day abstraction. Session spacing affects explosive adaptation after hard endurance. Both sessions share one day and one time budget; there is no second recovery-day bonus. Per-session RPE/load and combined duration-weighted RPE appear in the debrief.
- Active injuries restrict relevant gym targets; femoral bone stress blocks all gym. In-game rehabilitation is a separate choice and never implies clinical clearance. Current cases still need healing milestones and reassessment. Recovery durations and restrictions remain deliberately fictional.

## Disagreements and exclusions

- The Masters periodization summary suggests reducing intensity as well as volume for tapering; SSISA's taper material emphasizes reducing volume while retaining intensity. We do not turn that disagreement into a universal percentage or automatic taper plan. Manual shorter high-intensity sessions remain possible within current restrictions.
- Some strength material frames hypertrophy as undesirable for cyclists. The game does not impose an automatic large mass gain or universal performance penalty from strength training; changes are small and depend on emphasis.
- Biomechanical associations are not sufficient to diagnose an individual's injury. No gait defect, hormone state, blood result, supplement efficacy or clinical clearance is inferred from a game profile.
- Full periodization, exercise sets/reps, nutrition/hydration, heat/altitude, HRV and other unimplemented subjects are explicitly listed in the coverage audit. Indexing a document is not implementing all its principles.

## Save compatibility and privacy

Version 5 validates development arrays, career progression and reports. Version 3 careers preserve days, physiological state, injuries and history; new development starts on the migration day at 100%, with default missing background age 30 / 2 endurance years / 0 gym years / 40% modelled muscle. Version 4 keeps existing development unchanged. Older versions start XP/mastery tracking on migration; incomplete history is not extrapolated into invented lifetime totals. No past penalties are invented. The legacy browser-storage key is retained intentionally so existing progress is found. New-profile replacement still requires confirmation, import/export remains available, and invalid saves are protected from overwrite.

Raw course PDFs, extracted text, browser saves and personal source paths are excluded from Git and hosting. The source audit publishes only document titles/page counts and original implementation notes. The optional AI narrator is unchanged, remains off without server configuration, and cannot alter the model or overrule injury restrictions.

## Verification

Run `node --test` and `node scripts/build.mjs`. Tests cover initialization across ages, delayed cumulative effects, experience sensitivity, recovery, actual performance caps, gym load units, budget atomicity, regional restrictions, delayed soreness, race effects, concurrent training, multiweek strength gains, old-save migration and corrupt input rejection. These are software invariants and scenario checks, **not clinical validation**.

## Career progression and shared-course design

The user's WGT comparison inspired separate earned XP and practical ability. [WGT's public help](https://www.wgt.com/help/) describes XP earned through play and progress toward levels; our rules below are original game design, not a replication of its mechanics.

- XP comes from completed work, capped daily and scaled by quality. Rest earns no XP but restores capacity to train. Races award a finish bonus. No wall-clock timer or login streak grants free development.
- Level thresholds follow `180 × (level − 1)^1.65`, capped at level 50. Levels unlock the circuit at 1 / 3 / 6 / 10; they do not multiply power or pace. Imported backgrounds do not grant pre-earned game XP.
- Swim/bike/run mastery grows only from completed, quality-weighted minutes in that sport, with diminishing gains. It represents practiced execution, separate from aerobic conditioning. At maximum mastery, race execution factors improve swim speed by 6%, bike speed by 3% and run speed by 4% in the game; these invented bonuses are not medical research results.
- Race craft grows through finishes, reducing transition time by up to 90 seconds and bike-to-run execution loss by up to 35%. It cannot cancel exhaustion, insufficient durability or injury restrictions. Total athlete development (physiology, skill and strategy) matters; a level label alone does not.
- Calendar seasons are 365 game days. Age and training experience continue advancing; milestone awards combine time with actual training, so resting for years does not earn veteran achievements. A one-week fast-forward runs five short mixed-sport sessions plus recovery days, with conservative fatigue overrides and early stop on a new injury. This is a convenient starter week, not a periodization optimizer or an ideal programme for every athlete.
- First Light: 0.3 / 8 / 2 km flat; Harbour Loop: 0.75 / 20 / 5 km flat; Metro Classic: 1.5 / 40 / 10 km rolling; Summit Circuit: 1.5 / 40 / 10 km hilly. Event geometry overrides user course/distance options in the engine, so records are comparable within that event. Conditions are fixed, with no wind model. Route drawings are decorative schematics, not surveyed routes.
- Medal times are fixed fictional benchmark targets. Personal bests persist even after the rolling race log is trimmed. Custom standard-distance practice earns experience but cannot overwrite fixed-course records.
- No live competitors, multiplayer service, ranked matchmaking, real-world courses, pay-to-win equipment, anti-cheat or cross-device account persistence are claimed. Browser-local saves are editable; a trustworthy public leaderboard would require server-authoritative validation.

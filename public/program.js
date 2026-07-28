const PROGRAM = {
  A: {
    subtitle: "Push / Pull / Legs · balanced",
    groups: [
      {
        label: "Superset 1",
        hint: "alternate, minimal rest between the pair",
        exercises: [
          { id: "a_chestpress", name: "Cable Chest Press", scheme: "3 × 10–12", sets: 3, defWeight: 40, target: "Chest, front delts, triceps" },
          { id: "a_seatedrow", name: "Seated Cable Row", scheme: "3 × 10–12", sets: 3, defWeight: 50, target: "Mid-back, lats, biceps" },
        ],
      },
      {
        label: "Superset 2",
        hint: "alternate, minimal rest between the pair",
        exercises: [
          { id: "a_latpull", name: "Lat Pulldown", scheme: "3 × 10–12", sets: 3, defWeight: 60, target: "Lats, biceps, rear delts" },
          { id: "a_legpress", name: "Leg Press", scheme: "3 × 10–12", sets: 3, defWeight: 120, target: "Quads, glutes, hamstrings" },
        ],
      },
      {
        label: "Superset 3",
        hint: "alternate, minimal rest between the pair",
        exercises: [
          { id: "a_pushdown", name: "Cable Triceps Pushdown", scheme: "2 × 12–15", sets: 2, defWeight: 30, target: "Triceps" },
          { id: "a_curl", name: "Cable Curl", scheme: "2 × 12–15", sets: 2, defWeight: 30, target: "Biceps" },
        ],
      },
      {
        label: "Finisher",
        hint: "shoulder health · quick",
        exercises: [
          { id: "a_facepull", name: "Face Pull", scheme: "2 × 15", sets: 2, defWeight: 25, target: "Rear delts, rotator cuff, upper back" },
        ],
      },
    ],
  },
  B: {
    subtitle: "Shoulders / Back / Legs · shoulder-friendly",
    groups: [
      {
        label: "Superset 1",
        hint: "alternate, minimal rest between the pair",
        exercises: [
          { id: "b_latraise", name: "Cable Lateral Raise", scheme: "3 × 12–15", sets: 3, defWeight: 10, target: "Side delts (swap for machine press if pain-free)" },
          { id: "b_1armrow", name: "Single-Arm Cable Row", scheme: "3 × 10–12 / side", sets: 3, defWeight: 30, target: "Lats, mid-back, core" },
        ],
      },
      {
        label: "Superset 2",
        hint: "alternate, minimal rest between the pair",
        exercises: [
          { id: "b_legcurl", name: "Leg Curl (machine)", scheme: "3 × 12–15", sets: 3, defWeight: 40, target: "Hamstrings · slow 2–3s lowering, start light (prior strain)" },
          { id: "b_pullover", name: "Wide Pulldown / Cable Pullover", scheme: "3 × 10–12", sets: 3, defWeight: 55, target: "Lats, chest, serratus" },
        ],
      },
      {
        label: "Superset 3",
        hint: "alternate, minimal rest between the pair",
        exercises: [
          { id: "b_fly", name: "Low-to-High Cable Fly", scheme: "2 × 12–15", sets: 2, defWeight: 15, target: "Upper chest, front delt" },
          { id: "b_revfly", name: "Cable Reverse Fly", scheme: "2 × 15", sets: 2, defWeight: 15, target: "Rear delts, upper back" },
        ],
      },
      {
        label: "Finisher",
        hint: "core · anti-rotation",
        exercises: [
          { id: "b_pallof", name: "Cable Pallof Press", scheme: "2 × 12 / side", sets: 2, defWeight: 20, target: "Core, obliques" },
        ],
      },
    ],
  },
};

export const COMMON_SYMPTOMS = [
  "fever",
  "headache",
  "cough",
  "fatigue",
  "shortness of breath",
  "breathing difficulty",
  "chest pain",
  "rash",
  "itching",
  "vomiting",
  "nausea",
  "diarrhea",
  "stomach pain",
  "abdominal pain",
  "sore throat",
  "dizziness",
  "swelling",
  "redness",
  "burning urination",
  "joint pain",
  "back pain",
  "eye redness"
];

export const EMERGENCY_PATTERNS = [
  {
    keywords: ["chest pain", "shortness of breath", "difficulty breathing"],
    advice: "Seek emergency care immediately or call local emergency services."
  },
  {
    keywords: ["stroke", "face drooping", "slurred speech", "arm weakness"],
    advice: "This may indicate a stroke. Go to emergency care immediately."
  },
  {
    keywords: ["severe bleeding", "unconscious", "fainted", "seizure"],
    advice: "Emergency evaluation is needed immediately."
  }
];

export const CONDITION_RULES = [
  {
    id: "viral-illness",
    doctor: "General Physician",
    urgency: "Normal",
    conditions: [
      { name: "Viral Fever", probability: "High" },
      { name: "Seasonal Flu", probability: "Medium" }
    ],
    keywords: ["fever", "headache", "fatigue", "body pain", "cough", "sore throat"],
    nextSteps: [
      "Monitor temperature, hydration, and breathing changes.",
      "Consult a physician if symptoms worsen or last more than 2 to 3 days.",
      "Use local emergency care sooner if breathing becomes difficult."
    ]
  },
  {
    id: "dermatology",
    doctor: "Dermatologist",
    urgency: "Normal",
    conditions: [
      { name: "Allergic Rash", probability: "High" },
      { name: "Contact Dermatitis", probability: "Medium" }
    ],
    keywords: ["rash", "itching", "redness", "skin", "spots", "blisters"],
    nextSteps: [
      "Keep the area clean and avoid new creams unless prescribed.",
      "Share how quickly the rash spread and whether there is fever.",
      "Urgent review is needed if swelling affects lips, eyes, or breathing."
    ]
  },
  {
    id: "cardio",
    doctor: "Cardiologist",
    urgency: "Emergency",
    conditions: [
      { name: "Acute Cardiac Issue", probability: "High" },
      { name: "Severe Respiratory Distress", probability: "Medium" }
    ],
    keywords: ["chest pain", "shortness of breath", "pressure", "left arm", "tightness"],
    nextSteps: [
      "Do not wait for an outpatient appointment.",
      "Go to emergency services immediately.",
      "Avoid exertion while arranging urgent transport."
    ]
  },
  {
    id: "gastro",
    doctor: "Gastroenterologist",
    urgency: "Urgent",
    conditions: [
      { name: "Gastroenteritis", probability: "High" },
      { name: "Food Poisoning", probability: "Medium" }
    ],
    keywords: ["vomiting", "diarrhea", "stomach pain", "abdominal pain", "nausea"],
    nextSteps: [
      "Watch for dehydration, reduced urination, or persistent vomiting.",
      "Consult a doctor within 24 hours if symptoms are moderate or ongoing.",
      "Emergency care is needed for blood in vomit or severe weakness."
    ]
  },
  {
    id: "uro",
    doctor: "Urologist",
    urgency: "Urgent",
    conditions: [
      { name: "Urinary Tract Infection", probability: "High" },
      { name: "Kidney Irritation", probability: "Medium" }
    ],
    keywords: ["burning urination", "urination", "pelvic pain", "frequent urination", "urine"],
    nextSteps: [
      "Share if there is fever, flank pain, or blood in urine.",
      "Plan a consultation within 24 hours.",
      "Urgent care is needed sooner for fever with severe back pain."
    ]
  },
  {
    id: "eye",
    doctor: "Ophthalmologist",
    urgency: "Urgent",
    conditions: [
      { name: "Conjunctival Irritation", probability: "Medium" },
      { name: "Eye Infection", probability: "Medium" }
    ],
    keywords: ["eye redness", "eye pain", "blurred vision", "watery eye"],
    nextSteps: [
      "Avoid rubbing the eye and do not share eye products.",
      "Seek urgent review if vision is reduced or pain is severe.",
      "Mention discharge, trauma, or contact lens use."
    ]
  }
];

export const HOSPITAL_DIRECTORY = {
  kolkata: [
    {
      name: "Apollo Multispeciality Hospital",
      distanceKm: 2.4,
      area: "Canal Circular Road",
      specialties: ["General Physician", "Cardiologist", "Dermatologist"]
    },
    {
      name: "AMRI Salt Lake",
      distanceKm: 4.1,
      area: "Salt Lake",
      specialties: ["Gastroenterologist", "General Physician", "Emergency"]
    },
    {
      name: "Medica Superspecialty Hospital",
      distanceKm: 5.3,
      area: "Mukundapur",
      specialties: ["Cardiologist", "Urologist", "Emergency"]
    }
  ],
  delhi: [
    {
      name: "Max Super Speciality Hospital",
      distanceKm: 2.8,
      area: "Saket",
      specialties: ["General Physician", "Cardiologist", "Dermatologist"]
    },
    {
      name: "Apollo Hospital Delhi",
      distanceKm: 5.4,
      area: "Sarita Vihar",
      specialties: ["Emergency", "Gastroenterologist", "Urologist"]
    }
  ],
  bangalore: [
    {
      name: "Manipal Hospital",
      distanceKm: 3.1,
      area: "Old Airport Road",
      specialties: ["General Physician", "Cardiologist", "Dermatologist"]
    },
    {
      name: "Aster CMI Hospital",
      distanceKm: 6.2,
      area: "Hebbal",
      specialties: ["Emergency", "Gastroenterologist", "Ophthalmologist"]
    }
  ],
  default: [
    {
      name: "City Care Multispeciality Clinic",
      distanceKm: 2.2,
      area: "Central District",
      specialties: ["General Physician", "Dermatologist", "Gastroenterologist"]
    },
    {
      name: "Sunrise Emergency Hospital",
      distanceKm: 5,
      area: "North Avenue",
      specialties: ["Emergency", "Cardiologist", "General Physician"]
    },
    {
      name: "HealthBridge Specialty Center",
      distanceKm: 6.8,
      area: "Lake Road",
      specialties: ["Urologist", "Ophthalmologist", "Dermatologist"]
    }
  ]
};

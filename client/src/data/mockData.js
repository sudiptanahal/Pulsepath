export const quickPrompts = [
  {
    label: "Fever",
    description: "Fever, headache, and body pain",
    prompt: "I have fever, headache, and body pain since yesterday."
  },
  {
    label: "Rash",
    description: "Red itchy rash on the arm",
    prompt: "There is a red itchy rash on my arm."
  },
  {
    label: "Breathing",
    description: "Chest tightness and shortness of breath",
    prompt: "I feel chest tightness and shortness of breath."
  },
  {
    label: "Child care",
    description: "Stomach pain and vomiting",
    prompt: "My child has stomach pain and vomiting."
  }
];

export const flowSteps = [
  "Describe symptoms in your own words",
  "Add a picture or use the phone camera",
  "Review urgency, possible causes, and doctor type",
  "Open nearby care options or export the report"
];

export const trustHighlights = [
  {
    label: "Smart Triage",
    value: "Clear urgency and next-step routing."
  },
  {
    label: "Photo Support",
    value: "Add visible symptom context when needed."
  },
  {
    label: "Fast Routing",
    value: "Nearby care options in the same flow."
  }
];

export const featuredProviders = [
  {
    name: "Apollo Multispeciality Hospital",
    type: "Hospital",
    distanceKm: 2.4,
    area: "Canal Circular Road",
    specialties: ["General Physician", "Cardiology", "Dermatology"],
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Apollo+Multispeciality+Hospital+Canal+Circular+Road+Kolkata"
  },
  {
    name: "AMRI Salt Lake",
    type: "Hospital",
    distanceKm: 4.1,
    area: "Salt Lake",
    specialties: ["Emergency", "General Physician", "Gastroenterology"],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=AMRI+Salt+Lake+Kolkata"
  },
  {
    name: "PulsePath Family Clinic",
    type: "Clinic",
    distanceKm: 1.2,
    area: "Park Street",
    specialties: ["General Physician", "Pediatrics", "Vaccination"],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Family+Clinic+Park+Street+Kolkata"
  },
  {
    name: "Skin & Care Clinic",
    type: "Clinic",
    distanceKm: 2.1,
    area: "Ballygunge",
    specialties: ["Dermatology", "Allergy", "Minor Procedures"],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Skin+Care+Clinic+Ballygunge+Kolkata"
  },
  {
    name: "Medica Superspecialty Hospital",
    type: "Hospital",
    distanceKm: 5.3,
    area: "Mukundapur",
    specialties: ["Emergency", "Cardiology", "Urology"],
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Medica+Superspecialty+Hospital+Mukundapur+Kolkata"
  },
  {
    name: "CarePoint Walk-In Clinic",
    type: "Clinic",
    distanceKm: 3.3,
    area: "New Town",
    specialties: ["General Physician", "Diagnostics", "Womens Health"],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Walk-In+Clinic+New+Town+Kolkata"
  }
];

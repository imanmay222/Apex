/*
 * Seed source: content transcribed from apexcaretechnologies.com.
 *
 * Product `summary` lines are generic category descriptions written for the rebuild — the
 * original site had no per-product copy; every card linked to one shared PDF. They are safe
 * placeholders: no standards, ratings or certifications are claimed. Real copy should replace
 * them through the admin API.
 *
 * This file is only read by the seed script and as a last-resort default for site settings.
 */

type Img = { src: string; alt: string };
type ProductCategory = {
  slug: string;
  title: string;
  summary: string;
  image: Img;
  group: "ppe" | "detection" | "fire" | "site" | "draeger";
};
type SurveyService = { slug: string; title: string; shortTitle?: string; image: Img; description: string };
type TrainingProgram = { slug: string; title: string; icon: string; summary: string };
type Testimonial = { name: string; quote: string };
type Logo = { name: string; src: string };
type ValuePillar = { title: string; icon: string; text: string };
type Leader = { name: string; qualification: string; role: string; image: string };
type SiteSettings = {
  companyName: string;
  legalName: string;
  tagline: string;
  description: string;
  foundedYear: number;
  phones: string[];
  landline: string;
  whatsapp: string;
  emails: string[];
  address: { street: string; locality: string; city: string; state: string; country: string; postalCode: string };
  mapsLink: string;
  mapEmbedSrc: string;
  social: { facebook: string; instagram: string; whatsapp: string };
  certificates: { label: string; value: string }[];
  teamSize: number;
};
export const site: SiteSettings = {
  companyName: "Apex Care Technologies",
  legalName: "Apex Care Technologies",
  tagline: "Industrial fire, safety, welding & hardware solutions",
  description:
    "Apex Care Technologies manufactures and supplies fire, safety, welding and hardware equipment to industries across India — backed by on-site surveys, calibration services and hands-on safety training.",
  foundedYear: 2022,
  phones: ["+91 87927 83208", "+91 88705 42533"],
  landline: "04142-453571",
  whatsapp: "918792783208",
  // Listed on the original contact page ("Mail us" + "Enquiry Mail"); decoded from its Cloudflare obfuscation.
  emails: [
    "enquiry@apexcaretechnologies.com",
    "admin@apexcaretechnologies.com",
    "apexcaresafety@gmail.com",
    "dmeajithkannan@gmail.com",
  ],
  address: {
    street: "Plot No 13, Sri Lakshmi Saraswathi Nagar",
    locality: "Arisiperiyankuppam",
    city: "Cuddalore",
    state: "Tamil Nadu",
    country: "India",
    postalCode: "607401",
  },
  mapsLink: "https://maps.app.goo.gl/s9WeuPugRNU4Yozj9",
  mapEmbedSrc:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4847.314064532553!2d79.7457396!3d11.7414373!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5499d16c4d28df%3A0x27b45cc0d32652cd!2sApex%20Care%20Technologies!5e1!3m2!1sen!2sin!4v1737375590623!5m2!1sen!2sin",
  social: {
    facebook:
      "https://www.facebook.com/people/Apex-care-technologies/61564431135629/",
    instagram: "https://www.instagram.com/apex_care_technologies2022/",
    whatsapp: "https://api.whatsapp.com/send?phone=918792783208&text=Hi%20",
  },
  certificates: [
    { label: "GSTIN", value: "33BUVPS9623R1ZB" },
    { label: "MSME / Udyam", value: "UDYAM-TN-04-0028119" },
    { label: "IEC", value: "BUVPS9623R" },
  ],
  teamSize: 16,
};

const p = (file: string) => `/media/products/${file}`;

export const productCategories: ProductCategory[] = [
  {
    slug: "head-protection",
    title: "Head Protection",
    summary: "Industrial safety helmets and hard hats with accessory mounts.",
    image: { src: p("head-production.png"), alt: "Industrial safety helmets" },
    group: "ppe",
  },
  {
    slug: "eye-protection",
    title: "Eye Protection",
    summary: "Safety spectacles, goggles and over-specs for impact and splash.",
    image: { src: p("eye-production.png"), alt: "Safety goggles and spectacles" },
    group: "ppe",
  },
  {
    slug: "ear-protection",
    title: "Ear Protection",
    summary: "Ear muffs and plugs for high-noise plant environments.",
    image: { src: p("ear-production.png"), alt: "Ear muffs and ear plugs" },
    group: "ppe",
  },
  {
    slug: "respiratory-protection",
    title: "Respiratory Protection",
    summary: "Half and full face masks, filters and disposable respirators.",
    image: { src: p("respiratory-production.png"), alt: "Respiratory masks" },
    group: "ppe",
  },
  {
    slug: "hand-protection",
    title: "Hand Protection",
    summary: "Cut, chemical, heat and general-purpose industrial gloves.",
    image: { src: p("hand-production.png"), alt: "Industrial safety gloves" },
    group: "ppe",
  },
  {
    slug: "body-protection",
    title: "Body Protection",
    summary: "Coveralls, aprons and protective clothing for plant work.",
    image: { src: p("body-production.png"), alt: "Protective coveralls" },
    group: "ppe",
  },
  {
    slug: "foot-protection",
    title: "Foot Protection",
    summary: "Safety shoes and boots for industrial and site conditions.",
    image: { src: p("foot-production.png"), alt: "Industrial safety footwear" },
    group: "ppe",
  },
  {
    slug: "safety-jackets",
    title: "Safety Jackets",
    summary: "High-visibility vests and reflective jackets.",
    image: { src: p("safety-jackets.png"), alt: "High visibility safety jackets" },
    group: "ppe",
  },
  {
    slug: "arc-safety",
    title: "Arc Safety",
    summary: "Arc-rated clothing and accessories for electrical work.",
    image: { src: p("arc-safety.png"), alt: "Arc flash protective equipment" },
    group: "ppe",
  },
  {
    slug: "fall-protection",
    title: "Fall Protection & Ladders",
    summary: "Harnesses, lanyards, anchors, accessories and access ladders.",
    image: { src: p("fall-protection.png"), alt: "Fall protection harness" },
    group: "ppe",
  },
  {
    slug: "disposable-products",
    title: "Disposable Products",
    summary: "Single-use coveralls, caps, shoe covers and masks.",
    image: { src: p("disposable-product.png"), alt: "Disposable protective wear" },
    group: "ppe",
  },
  {
    slug: "raincoat",
    title: "Raincoats",
    summary: "Industrial rainwear for outdoor and monsoon site work.",
    image: { src: p("versalis-raincoat.png"), alt: "Industrial raincoat" },
    group: "ppe",
  },

  {
    slug: "draeger-x-plore-8000",
    title: "Dräger X-plore 8000 PAPR",
    summary: "Powered air-purifying respirator system.",
    image: { src: p("x-plore-8700.png"), alt: "Dräger X-plore 8000 PAPR" },
    group: "draeger",
  },
  {
    slug: "draeger-polytron-7000",
    title: "Dräger Polytron 7000",
    summary: "Fixed gas transmitter for continuous area monitoring.",
    image: { src: p("polytron-7000.png"), alt: "Dräger Polytron 7000" },
    group: "draeger",
  },
  {
    slug: "draeger-polytron-5200",
    title: "Dräger Polytron 5200 CAT",
    summary: "Fixed transmitter for combustible gas detection.",
    image: { src: p("polytron-5200-cat.png"), alt: "Dräger Polytron 5200 CAT" },
    group: "draeger",
  },
  {
    slug: "draeger-alcotest-5000",
    title: "Dräger Alcotest 5000",
    summary: "Contact-free breath alcohol screening for gate checks.",
    image: { src: p("alcotest-5000.png"), alt: "Dräger Alcotest 5000" },
    group: "draeger",
  },
  {
    slug: "draeger-pac-6500",
    title: "Dräger Pac 6500",
    summary: "Single-gas personal detector for field use.",
    image: { src: p("pac-6500.png"), alt: "Dräger Pac 6500" },
    group: "draeger",
  },
  {
    slug: "draeger-x-am-2500",
    title: "Dräger X-am 2500",
    summary: "Portable multi-gas detector for confined space entry.",
    image: { src: p("x-am-2500.png"), alt: "Dräger X-am 2500" },
    group: "draeger",
  },

  {
    slug: "gas-detectors",
    title: "Gas & Sensor Devices",
    summary: "Alcohol, sound, pH and TDS meters plus portable gas detectors.",
    image: { src: p("sensor-devices.png"), alt: "Gas detection and sensor devices" },
    group: "detection",
  },
  {
    slug: "scba",
    title: "Self Contained Breathing Apparatus",
    summary: "SCBA sets for emergency response and confined space work.",
    image: { src: p("scba.png"), alt: "Self contained breathing apparatus" },
    group: "detection",
  },
  {
    slug: "air-respirator-unit",
    title: "Air Respirator Unit",
    summary: "Supplied-air respirator units for extended duration work.",
    image: { src: p("air-respirator-unit.png"), alt: "Air respirator unit" },
    group: "detection",
  },
  {
    slug: "breathing-apparatus-box",
    title: "Breathing Apparatus Box",
    summary: "Wall-mounted storage for rapid SCBA deployment.",
    image: { src: p("breathing-apparatus.png"), alt: "Breathing apparatus storage box" },
    group: "detection",
  },
  {
    slug: "torch-sound-detection",
    title: "Torch & Sound Detection",
    summary: "Flameproof torches and sound level measurement devices.",
    image: { src: p("torch-sound-detection.png"), alt: "Flameproof torch" },
    group: "detection",
  },

  {
    slug: "fire-protection",
    title: "Fire Protection",
    summary: "Fire fighting equipment and protective gear.",
    image: { src: p("fire-production.png"), alt: "Fire protection equipment" },
    group: "fire",
  },
  {
    slug: "fire-extinguisher",
    title: "Fire Extinguishers",
    summary: "Portable extinguishers across agent types and capacities.",
    image: { src: p("fire-extinguisher.png"), alt: "Fire extinguishers" },
    group: "fire",
  },
  {
    slug: "fire-suppression-system",
    title: "Fire Suppression Systems",
    summary: "Engineered suppression for plant and equipment risk areas.",
    image: { src: p("fire-suppression-system.png"), alt: "Fire suppression system" },
    group: "fire",
  },
  {
    slug: "automatic-panel-protection",
    title: "Automatic Panel Protection",
    summary: "Self-actuating suppression for electrical panels.",
    image: { src: p("automatic-panel-protection.png"), alt: "Automatic panel fire protection" },
    group: "fire",
  },
  {
    slug: "automatic-room-protection",
    title: "Automatic Room Protection",
    summary: "Room-level suppression for server and control rooms.",
    image: { src: p("automatic-room-protection.png"), alt: "Automatic room fire protection" },
    group: "fire",
  },
  {
    slug: "kitchen-hood-protection",
    title: "Kitchen Hood Protection",
    summary: "Wet chemical suppression for commercial kitchen hoods.",
    image: { src: p("kitchen-hood-protection.png"), alt: "Kitchen hood fire suppression" },
    group: "fire",
  },
  {
    slug: "chemical-protection",
    title: "Chemical Protection",
    summary: "Chemical suits, gloves and splash protection.",
    image: { src: p("chemical-production.png"), alt: "Chemical protective suit" },
    group: "fire",
  },

  {
    slug: "first-aid",
    title: "First Aid",
    summary: "First aid kits, cabinets and refill consumables.",
    image: { src: p("first-aid.png"), alt: "First aid kit" },
    group: "site",
  },
  {
    slug: "safety-shower",
    title: "Safety Showers & Eye Wash",
    summary: "Emergency showers and eye wash stations.",
    image: { src: p("safety-shower.png"), alt: "Emergency safety shower" },
    group: "site",
  },
  {
    slug: "traffic-road-safety",
    title: "Traffic & Road Safety",
    summary: "Speed breakers, road studs, cones, barriers and convex mirrors.",
    image: { src: p("traffic-road-safety.png"), alt: "Road safety equipment" },
    group: "site",
  },
  {
    slug: "safety-signages",
    title: "Safety Signages",
    summary: "Mandatory, warning and prohibition signage for plants.",
    image: { src: p("safety-signages.png"), alt: "Industrial safety signage" },
    group: "site",
  },
  {
    slug: "lockout-tagout",
    title: "Lockout & Tagout",
    summary: "LOTO padlocks, hasps, valve locks, tags and station boards.",
    image: { src: p("lockout-tagout.png"), alt: "Lockout tagout devices" },
    group: "site",
  },
  {
    slug: "spill-kit-blankets",
    title: "Spill Kits & Blankets",
    summary: "Absorbent spill kits, booms, pads and fire blankets.",
    image: { src: p("spillkit-blankets.png"), alt: "Spill kit and fire blanket" },
    group: "site",
  },
  {
    slug: "anti-static-products",
    title: "Anti-Static Products",
    summary: "ESD-safe wear, mats and grounding accessories.",
    image: { src: p("anti-static-products.png"), alt: "Anti static products" },
    group: "site",
  },
  {
    slug: "anti-slip-tape",
    title: "Anti-Slip Tape",
    summary: "Floor marking and anti-skid tapes for walkways and stairs.",
    image: { src: p("anti-slip-tape.png"), alt: "Anti slip floor tape" },
    group: "site",
  },
  {
    slug: "security",
    title: "Security Equipment",
    summary: "Site security and access control accessories.",
    image: { src: p("security.png"), alt: "Security equipment" },
    group: "site",
  },
];

export const productGroups: { id: ProductCategory["group"]; title: string; blurb: string }[] = [
  {
    id: "ppe",
    title: "Personal Protective Equipment",
    blurb: "Head-to-toe protection for everyone on the floor.",
  },
  {
    id: "draeger",
    title: "Dräger Respiratory & Sensors",
    blurb: "Authorised range of Dräger detection and respiratory systems.",
  },
  {
    id: "detection",
    title: "Detection & Breathing Apparatus",
    blurb: "Gas detection, SCBA and supplied-air systems.",
  },
  {
    id: "fire",
    title: "Fire & Chemical Protection",
    blurb: "Extinguishers, suppression systems and chemical protection.",
  },
  {
    id: "site",
    title: "Site Safety & Facility",
    blurb: "Signage, LOTO, spill control, road safety and first aid.",
  },
];

export const featuredCategorySlugs = [
  "head-protection",
  "eye-protection",
  "ear-protection",
  "respiratory-protection",
  "hand-protection",
  "body-protection",
  "foot-protection",
  "traffic-road-safety",
];

const s = (file: string) => `/media/survey/${file}`;

export const surveys: SurveyService[] = [
  {
    slug: "gas-detection-system-survey",
    title: "Gas Detection System Survey",
    shortTitle: "Gas Detection System",
    image: { src: s("survey-1.jpg"), alt: "Gas detection system survey" },
    description:
      "Each industry and application come with their own specific requirements, challenges, and legal regulations, making it essential for gas detection systems to be tailored to each individual site. A solution that works perfectly for one facility may not be suitable for another, which is why we don't offer off-the-shelf products. Instead, we begin by discussing your precise needs through a detailed consultation process. Our experts will then design a system that is not too large or too small, but just right for your requirements, ensuring that it remains both reliable and compliant with industry standards.",
  },
  {
    slug: "scba",
    title: "Self-Contained Breathing Apparatus",
    shortTitle: "SCBA Servicing",
    image: { src: s("survey-2.jpg"), alt: "SCBA servicing and maintenance" },
    description:
      "Proper maintenance of SCBA sets is critical to ensure they are ready for immediate use in emergencies. Timely service and maintenance activities such as refilling air cylinders, performing hydrostatic testing, conducting weight-based and pressure-based content checks, and renewing or repairing valves are essential. Regular inspections and external maintenance work ensure that SCBA equipment operates at full efficiency and remains reliable when it's needed most in emergency situations. We ensure all of these aspects are handled meticulously, giving you peace of mind.",
  },
  {
    slug: "gas-detection-calibration",
    title: "Gas Detection Calibration",
    image: { src: s("survey-3.jpg"), alt: "Gas detector calibration" },
    description:
      "Calibration is a crucial process to ensure that your gas detection equipment remains accurate and dependable. We offer on-site calibration and certification services for both portable gas detectors and fixed gas detection systems. Our extensive inventory of calibration gas cylinders allows us to carry out on-board testing, ensuring that your equipment is functioning correctly. Additionally, we provide spare parts and repair services, ensuring that your systems are maintained at peak performance throughout their service life.",
  },
  {
    slug: "road-safety-traffic-products",
    title: "Road Safety & Traffic Products",
    image: { src: s("survey-4.jpg"), alt: "Road safety and traffic survey" },
    description:
      "Ensuring road safety within your facility is of paramount importance, and we are here to help you implement effective safety measures. Our team conducts comprehensive site assessments to determine the optimal locations for installing speed breakers, road studs, traffic signage, convex mirrors, and road crossing marks. We take the time to evaluate your specific needs and then provide tailored recommendations that enhance the safety and traffic flow in your plant. Our expert guidance ensures that the installation of these products is carried out in a way that maximizes their impact on safety.",
  },
  {
    slug: "fit-testing",
    title: "Respirator Fit Testing",
    shortTitle: "Fit Testing",
    image: { src: s("survey-5.jpg"), alt: "Respirator fit testing" },
    description:
      "Fit testing is a crucial part of ensuring that respiratory protective equipment fits properly and provides the necessary protection. We offer both quantitative and qualitative fit testing services. The quantitative method, which uses advanced equipment like PortaCount (TSI USA) or SE POHD pressure sensors, measures the fit with precision. For qualitative fit testing, we use irritant smoke — an OSHA-approved method that provides an accurate assessment of mask fit without relying on subjective responses. These tests are essential for ensuring that respirators, particularly P100 or FFP3 class models, offer the protection needed in hazardous environments.",
  },
  {
    slug: "height-safety",
    title: "Height Safety",
    image: { src: s("survey-6.jpg"), alt: "Work at height safety survey" },
    description:
      "Working at height presents significant risks, and effective planning and safety measures are critical to minimize these dangers. Our services include conducting detailed risk assessments for work-at-height activities, ensuring that all work is planned, organized, and carried out by competent professionals. We help identify the right equipment and collective safety measures, such as guardrails and working platforms, to prevent falls. When other measures are necessary, we also advise on fall-arrest solutions using personal protective equipment. Our approach ensures that all work at height is performed safely and in accordance with regulatory guidelines.",
  },
  {
    slug: "safety-shower-maintenance",
    title: "Safety Shower Maintenance",
    shortTitle: "Safety Showers",
    image: { src: s("survey-7.jpg"), alt: "Safety shower maintenance" },
    description:
      "The functionality of safety showers and eye washes is essential in emergencies, and regular maintenance is required to ensure they are in good working order. We recommend performing weekly activation checks and documenting them to maintain a full history as per standard requirements. Additionally, a visual inspection of all equipment, including shower heads, nozzles, and diffusers, should be conducted to prevent debris or bacteria build-up. If the equipment includes electrical components, regular inspections for damage should also be performed. These steps ensure that your safety showers are always operational when needed most.",
  },
  {
    slug: "lockout-tagout",
    title: "Lockout Tagout (LOTO)",
    shortTitle: "Lockout Tagout",
    image: { src: s("survey-8.jpg"), alt: "Lockout tagout survey" },
    description:
      "A proper Lockout Tagout (LOTO) system is essential to protect workers from hazardous energy sources during maintenance and repair activities. Our team conducts thorough site surveys to identify energy sources and associated hazards, following OSHA standards and guidelines. Based on this survey, we provide recommendations on the appropriate isolation methods and devices to ensure worker safety. Additionally, we offer customized training programs for all levels of employees, both through classroom sessions and hands-on demonstrations. Our services also include the installation of specialized LOTO products to meet your facility's specific needs, ensuring that energy sources are safely isolated and workers are trained to follow proper procedures.",
  },
  {
    slug: "chemical-hazardous-protection",
    title: "Chemical, Hand & Body Protection",
    shortTitle: "Chemical Protection",
    image: { src: s("survey-9.jpg"), alt: "Chemical hazard protection survey" },
    description:
      "Ensuring worker safety in hazardous environments, especially when working at heights or dealing with chemical hazards, requires a comprehensive approach. We conduct detailed risk assessments to identify potential hazards and recommend protective measures, such as body protection and fall protection systems. Our surveys also highlight necessary changes to work practices, environments, and safety systems to reduce the risk of injuries. We emphasize the importance of continuously re-evaluating hazards to ensure ongoing safety and compliance. Through this process, we provide tailored recommendations for improving protection and maintaining the safety and health of workers.",
  },
];

export const featuredSurveySlugs = ["gas-detection-system-survey", "scba", "fit-testing"];

export const trainingPrograms: TrainingProgram[] = [
  {
    slug: "papr-training",
    title: "PAPR Training",
    icon: "Wind",
    summary: "Donning, doffing, battery and filter handling for powered respirators.",
  },
  {
    slug: "scba-training",
    title: "SCBA Training",
    icon: "Gauge",
    summary: "Cylinder checks, wear drills and emergency air management.",
  },
  {
    slug: "lockout-tagout-safety-training",
    title: "Lockout Tagout Safety",
    icon: "Lock",
    summary: "Energy isolation procedure, device selection and verification.",
  },
  {
    slug: "forklift-crane-safety-training",
    title: "Forklift & Crane Safety",
    icon: "Forklift",
    summary: "Operator awareness, load handling and spotter communication.",
  },
  {
    slug: "first-aid-training",
    title: "First Aid Training",
    icon: "HeartPulse",
    summary: "Primary survey, CPR basics, bleeding control and casualty handling.",
  },
  {
    slug: "fire-emergency-training",
    title: "Fire & Emergency",
    icon: "Flame",
    summary: "Extinguisher selection, live-fire practice and evacuation routes.",
  },
  {
    slug: "mock-drill-training",
    title: "Mock Drill Training",
    icon: "ShieldCheck",
    summary: "Scenario-based drills with timing, roles and post-drill review.",
  },
  {
    slug: "chemical-safety-training",
    title: "Chemical Safety",
    icon: "Droplets",
    summary: "MSDS reading, spill response and chemical PPE selection.",
  },
  {
    slug: "electrical-safety-auditor-training",
    title: "Electrical Safety Auditor",
    icon: "Zap",
    summary: "Arc flash awareness, audit checklists and control hierarchy.",
  },
  {
    slug: "ppes-safe-material-handling",
    title: "PPE & Safe Material Handling",
    icon: "HardHat",
    summary: "Correct PPE use plus manual and mechanical handling technique.",
  },
];

export const trainingGallery = Array.from({ length: 8 }, (_, i) => ({
  src: `/media/training/gallery-${i + 1}.jpeg`,
  alt: `Apex Care Technologies safety training session ${i + 1}`,
}));

export const testimonials: Testimonial[] = [
  {
    name: "Ravi Kumar",
    quote:
      "Apex Care Technologies ensures timely deliveries and top-quality safety products at our sites.",
  },
  {
    name: "Priya",
    quote:
      "Their dedication to safety and quality gives us confidence in protecting our workforce.",
  },
  {
    name: "Vikram",
    quote: "Apex Care Technologies delivers high-quality products on time, every time.",
  },
  {
    name: "Manisha",
    quote:
      "Great quality, competitive pricing, and consistent delivery from Apex Care Technologies.",
  },
  {
    name: "Arun",
    quote: "Apex Care Technologies never compromises on safety and reliability.",
  },
  {
    name: "Selvam",
    quote: "A trusted partner offering excellent products and exceptional customer service.",
  },
];

export const clientLogos: Logo[] = Array.from({ length: 12 }, (_, i) => ({
  name: `Client ${i + 1}`,
  src: `/media/clients/client-${i + 1}.png`,
}));

export const brandLogos: Logo[] = Array.from({ length: 7 }, (_, i) => ({
  name: `Brand ${i + 1}`,
  src: `/media/about/brand-${i + 1}.png`,
}));

export const valuePillars: ValuePillar[] = [
  {
    title: "Vision & Mission",
    icon: "Rocket",
    text: "Our mission is to eliminate fire and safety accidents in industries, ensuring no life is lost. We focus on sustainable growth, setting new benchmarks in safety, product quality, and customer happiness.",
  },
  {
    title: "Excellence Through Expertise",
    icon: "Award",
    text: "Guided by Mrs. N. Selvarani (B.Pharm.) and Mr. K. Ajithkumar (M.E., Safety), we combine integrity and technical expertise. Their leadership helps us offer unmatched solutions to clients' needs.",
  },
  {
    title: "Our Team",
    icon: "Users",
    text: "Our dedicated team of 16 professionals works around the clock, committed to providing the best products and services. We ensure the highest levels of safety, quality, and customer satisfaction.",
  },
  {
    title: "Our Infrastructure",
    icon: "Building2",
    text: "Operating from a two-floor warehouse in Cuddalore, Tamil Nadu, we meet the demands of our growing client base. Our modern infrastructure guarantees efficient operations and timely deliveries across all sectors.",
  },
];

export const leadership: Leader[] = [
  {
    name: "Mrs. N. Selvarani",
    qualification: "B.Pharm.",
    role: "Proprietor",
    image: "/media/about/profile.jpg",
  },
  {
    name: "K. Ajithkumar",
    qualification: "M.E. (Safety)",
    role: "Managing Director",
    image: "/media/about/profile.jpg",
  },
  {
    name: "Dr. A. Raguraman",
    qualification: "M.Sc, M.Phil, B.Ed, Ph.D",
    role: "Quality Controller",
    image: "/media/about/profile.jpg",
  },
];

export const aboutCopy = {
  intro:
    "Apex Care Technologies is a manufacturer and supplier in the fire, safety, welding and hardware industries. Since our inception in 2022 we have built a reputation for reliable, well-specified equipment — backed by people who understand how it actually gets used on a plant floor.",
  network:
    "With an all-India network of business associates, we deliver bulk materials to industries nationwide. We are more than a supplier: we survey your site, specify what fits, train your people on it, and keep it serviced.",
};

export const differentiators = [
  { title: "Superior quality", icon: "BadgeCheck" },
  { title: "Value for money", icon: "IndianRupee" },
  { title: "On-time deliveries", icon: "Truck" },
  { title: "Modern infrastructure", icon: "Factory" },
];

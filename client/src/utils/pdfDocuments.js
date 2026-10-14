import { jsPDF } from "jspdf";
import { buildDoctorHandoff, buildEmergencyCard, formatTime } from "./profile.js";

const BRAND_NAME = "PulsePath";
const LOGO_PATH = "/icon-192.svg";
const MARGIN_X = 46;
const MARGIN_Y = 42;
const CARD_GAP = 12;
const COLORS = {
  primary: [11, 101, 216],
  deep: [16, 37, 59],
  muted: [96, 114, 132],
  line: [219, 228, 235],
  soft: [244, 247, 243],
  accent: [223, 247, 240],
  white: [255, 255, 255],
  danger: [223, 79, 61],
  warning: [217, 138, 22]
};

let logoDataUrlPromise = null;

function getPageWidth(doc) {
  return doc.internal.pageSize.getWidth();
}

function getPageHeight(doc) {
  return doc.internal.pageSize.getHeight();
}

function getContentWidth(doc) {
  return getPageWidth(doc) - MARGIN_X * 2;
}

function formatDocumentTime() {
  return formatTime(new Date().toISOString());
}

function sanitizeFileName(value) {
  return String(value || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeValue(value, fallback = "Not provided") {
  const text = String(value || "").trim();
  return text || fallback;
}

function createDoc(title) {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4"
  });

  doc.setProperties({
    title: `${BRAND_NAME} ${title}`,
    subject: title,
    author: BRAND_NAME,
    creator: BRAND_NAME
  });

  return doc;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function getBrandLogoDataUrl() {
  if (logoDataUrlPromise) {
    return logoDataUrlPromise;
  }

  logoDataUrlPromise = (async () => {
    try {
      const response = await fetch(LOGO_PATH);

      if (!response.ok) {
        throw new Error("Logo request failed.");
      }

      const svgText = await response.text();
      const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`);
      const canvas = document.createElement("canvas");
      const size = 144;
      const context = canvas.getContext("2d");

      if (!context) {
        return null;
      }

      canvas.width = size;
      canvas.height = size;
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  })();

  return logoDataUrlPromise;
}

function drawFallbackBrandMark(doc, x, y, size) {
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(x, y, size, size, 18, 18, "F");
  doc.setFillColor(...COLORS.accent);
  doc.circle(x + size / 2, y + size / 2, size * 0.3, "F");
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(4);
  doc.line(x + size * 0.35, y + size * 0.52, x + size * 0.46, y + size * 0.64);
  doc.line(x + size * 0.46, y + size * 0.64, x + size * 0.68, y + size * 0.38);
}

function getUrgencyTone(level = "") {
  if (level === "Emergency") {
    return {
      fill: COLORS.danger,
      text: [255, 255, 255]
    };
  }

  if (level === "Urgent") {
    return {
      fill: COLORS.warning,
      text: [255, 255, 255]
    };
  }

  return {
    fill: COLORS.primary,
    text: [255, 255, 255]
  };
}

function drawHeader(doc, { title, subtitle, generatedAt, urgencyLevel, logoDataUrl }) {
  const pageWidth = getPageWidth(doc);
  const headerWidth = pageWidth - MARGIN_X * 2;
  const headerHeight = 100;
  const cardX = MARGIN_X;
  const cardY = MARGIN_Y;

  doc.setFillColor(...COLORS.soft);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(cardX, cardY, headerWidth, headerHeight, 22, 22, "FD");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", cardX + 16, cardY + 16, 52, 52);
  } else {
    drawFallbackBrandMark(doc, cardX + 16, cardY + 16, 52);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text(BRAND_NAME.toUpperCase(), cardX + 80, cardY + 28);

  doc.setFontSize(22);
  doc.setTextColor(...COLORS.deep);
  doc.text(title, cardX + 80, cardY + 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  const subtitleLines = doc.splitTextToSize(subtitle, headerWidth - 280);
  doc.text(subtitleLines, cardX + 80, cardY + 72);

  const metaX = cardX + headerWidth - 170;
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(metaX, cardY + 14, 152, 72, 16, 16, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text("GENERATED", metaX + 14, cardY + 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.deep);
  const generatedLines = doc.splitTextToSize(generatedAt, 120);
  doc.text(generatedLines, metaX + 14, cardY + 48);

  if (urgencyLevel) {
    const tone = getUrgencyTone(urgencyLevel);
    doc.setFillColor(...tone.fill);
    doc.roundedRect(metaX + 14, cardY + 58, 88, 18, 9, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...tone.text);
    doc.text(urgencyLevel.toUpperCase(), metaX + 58, cardY + 70, { align: "center" });
  }

  return cardY + headerHeight + 24;
}

function drawSectionHeading(doc, title, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text(title.toUpperCase(), MARGIN_X, y);

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(1);
  doc.line(MARGIN_X, y + 8, MARGIN_X + getContentWidth(doc), y + 8);

  return y + 24;
}

function ensureSpace(doc, y, requiredHeight, headerContext) {
  const limit = getPageHeight(doc) - 56;

  if (y + requiredHeight <= limit) {
    return y;
  }

  doc.addPage();
  return drawHeader(doc, headerContext);
}

function drawFieldGrid(doc, fields, y, headerContext) {
  const columnGap = 12;
  const columnWidth = (getContentWidth(doc) - columnGap) / 2;

  for (let index = 0; index < fields.length; index += 2) {
    const rowItems = fields.slice(index, index + 2);
    const measured = rowItems.map((item) => {
      const valueLines = doc.splitTextToSize(normalizeValue(item.value), columnWidth - 24);
      return {
        ...item,
        valueLines,
        height: Math.max(72, 34 + valueLines.length * 14)
      };
    });
    const rowHeight = Math.max(...measured.map((item) => item.height));

    y = ensureSpace(doc, y, rowHeight + CARD_GAP, headerContext);

    measured.forEach((item, itemIndex) => {
      const x = MARGIN_X + itemIndex * (columnWidth + columnGap);

      doc.setFillColor(...COLORS.white);
      doc.setDrawColor(...COLORS.line);
      doc.roundedRect(x, y, columnWidth, rowHeight, 16, 16, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      doc.text(item.label.toUpperCase(), x + 14, y + 22);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.deep);
      doc.text(item.valueLines, x + 14, y + 42);
    });

    y += rowHeight + CARD_GAP;
  }

  return y + 2;
}

function drawParagraphCard(doc, title, content, y, headerContext) {
  const bodyLines = doc.splitTextToSize(normalizeValue(content), getContentWidth(doc) - 28);
  const cardHeight = 32 + bodyLines.length * 14 + 16;

  y = ensureSpace(doc, y, cardHeight + CARD_GAP, headerContext);

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(MARGIN_X, y, getContentWidth(doc), cardHeight, 18, 18, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(title.toUpperCase(), MARGIN_X + 14, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.deep);
  doc.text(bodyLines, MARGIN_X + 14, y + 42);

  return y + cardHeight + CARD_GAP;
}

function drawBulletSection(doc, title, items, y, headerContext) {
  y = drawSectionHeading(doc, title, y);

  const list = items.length ? items : ["No items recorded."];

  list.forEach((item) => {
    const lines = doc.splitTextToSize(String(item), getContentWidth(doc) - 30);
    const itemHeight = 20 + lines.length * 14;

    y = ensureSpace(doc, y, itemHeight + 6, headerContext);

    doc.setFillColor(...COLORS.primary);
    doc.circle(MARGIN_X + 7, y + 10, 2.5, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.deep);
    doc.text(lines, MARGIN_X + 18, y + 14);

    y += itemHeight;
  });

  return y + 10;
}

function drawObjectCards(doc, title, items, y, headerContext, mapItem) {
  y = drawSectionHeading(doc, title, y);
  const list = items.length
    ? items
    : [
        {
          title: "No items recorded",
          subtitle: "",
          body: "",
          footer: ""
        }
      ];

  list.forEach((item) => {
    const entry = mapItem && items.length ? mapItem(item) : item;
    const subtitleLines = entry.subtitle ? doc.splitTextToSize(entry.subtitle, getContentWidth(doc) - 28) : [];
    const bodyLines = entry.body ? doc.splitTextToSize(entry.body, getContentWidth(doc) - 28) : [];
    const footerLines = entry.footer ? doc.splitTextToSize(entry.footer, getContentWidth(doc) - 28) : [];
    const cardHeight =
      28 +
      subtitleLines.length * 13 +
      bodyLines.length * 13 +
      footerLines.length * 12 +
      (entry.linkLabel ? 18 : 0) +
      18;

    y = ensureSpace(doc, y, cardHeight + CARD_GAP, headerContext);

    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(MARGIN_X, y, getContentWidth(doc), cardHeight, 16, 16, "FD");

    let cursorY = y + 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.deep);
    doc.text(normalizeValue(entry.title, "Not provided"), MARGIN_X + 14, cursorY);
    cursorY += 16;

    if (subtitleLines.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.primary);
      doc.text(subtitleLines, MARGIN_X + 14, cursorY);
      cursorY += subtitleLines.length * 13 + 4;
    }

    if (bodyLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...COLORS.deep);
      doc.text(bodyLines, MARGIN_X + 14, cursorY);
      cursorY += bodyLines.length * 13 + 4;
    }

    if (footerLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(footerLines, MARGIN_X + 14, cursorY);
      cursorY += footerLines.length * 12 + 4;
    }

    if (entry.linkLabel && entry.linkUrl) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.primary);
      doc.textWithLink(entry.linkLabel, MARGIN_X + 14, cursorY + 8, {
        url: entry.linkUrl
      });
    }

    y += cardHeight + CARD_GAP;
  });

  return y + 4;
}

function addFooters(doc, note) {
  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    const pageHeight = getPageHeight(doc);
    const pageWidth = getPageWidth(doc);

    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.8);
    doc.line(MARGIN_X, pageHeight - 36, pageWidth - MARGIN_X, pageHeight - 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(note, MARGIN_X, pageHeight - 22);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - MARGIN_X, pageHeight - 22, {
      align: "right"
    });
  }
}

export async function downloadReportPdf(result, profile) {
  if (!result) {
    return;
  }

  const doc = createDoc("Clinical Triage Report");
  const logoDataUrl = await getBrandLogoDataUrl();
  const generatedAt = formatDocumentTime();
  const headerContext = {
    title: "Clinical Triage Report",
    subtitle: "Structured symptom summary and care routing prepared by PulsePath.",
    generatedAt,
    urgencyLevel: result?.urgency?.level,
    logoDataUrl
  };
  let y = drawHeader(doc, headerContext);

  y = drawFieldGrid(
    doc,
    [
      { label: "Patient", value: profile?.displayName },
      { label: "Urgency", value: `${result?.urgency?.level || "Pending"} - ${result?.recommendedDoctor?.specialty || "General Physician"}` },
      { label: "Age / Gender", value: `${normalizeValue(profile?.age)} / ${normalizeValue(profile?.gender)}` },
      { label: "Blood group", value: profile?.bloodGroup },
      { label: "Location used", value: result?.locationContext?.label || result?.locationContext?.displayName },
      { label: "Top care match", value: result?.nearbyHospitals?.[0]?.name || "Nearby care pending" }
    ],
    y,
    headerContext
  );

  y = drawParagraphCard(doc, "Clinical summary", result?.summary, y, headerContext);
  y = drawBulletSection(doc, "Detected symptoms", result?.symptoms || [], y, headerContext);

  y = drawObjectCards(doc, "Possible conditions", result?.possibleConditions || [], y, headerContext, (item) => ({
    title: `${item.name} ${item.probability ? `(${item.probability})` : ""}`.trim(),
    body: item.reason || ""
  }));

  y = drawObjectCards(doc, "Medicine and allergy safety", result?.safetyChecks || [], y, headerContext, (item) => ({
    title: item.title,
    subtitle: item.severity ? `${item.severity} priority flag` : "",
    body: item.detail || ""
  }));

  y = drawBulletSection(doc, "Recommended next steps", result?.nextSteps || [], y, headerContext);

  y = drawObjectCards(doc, "Nearby care options", (result?.nearbyHospitals || []).slice(0, 4), y, headerContext, (item) => ({
    title: item.name,
    subtitle: [item.type, Number.isFinite(item.distanceKm) ? `${item.distanceKm.toFixed(1)} km away` : ""]
      .filter(Boolean)
      .join(" | "),
    body: item.suitabilityReason || "Nearby care option",
    footer: [
      item.address || item.area,
      typeof item.suitabilityScore === "number"
        ? `${item.suitabilityLabel || "Suitability"} ${item.suitabilityScore}`
        : ""
    ]
      .filter(Boolean)
      .join(" | "),
    linkLabel: item.mapUrl ? "Open route in Google Maps" : "",
    linkUrl: item.mapUrl || ""
  }));

  drawParagraphCard(doc, "Clinical disclaimer", result?.disclaimer, y, headerContext);
  addFooters(doc, `${BRAND_NAME} decision-support report. This document does not confirm a diagnosis.`);
  doc.save(`${sanitizeFileName(profile?.displayName || "pulsepath")}-triage-report.pdf`);
}

export async function downloadHandoffPdf(result, profile) {
  if (!result) {
    return;
  }

  const handoff = buildDoctorHandoff(result, profile);
  const doc = createDoc("Doctor Handoff Summary");
  const logoDataUrl = await getBrandLogoDataUrl();
  const generatedAt = formatDocumentTime();
  const headerContext = {
    title: "Doctor Handoff Summary",
    subtitle: "Clinician-facing summary prepared for faster in-person handoff.",
    generatedAt,
    urgencyLevel: result?.urgency?.level,
    logoDataUrl
  };
  let y = drawHeader(doc, headerContext);

  y = drawFieldGrid(
    doc,
    handoff.lines.map((item) => ({
      label: item.label,
      value: item.value
    })),
    y,
    headerContext
  );

  y = drawParagraphCard(doc, "Case summary", result?.summary, y, headerContext);
  y = drawBulletSection(doc, "Immediate next steps", result?.nextSteps || [], y, headerContext);

  y = drawObjectCards(doc, "Safety checks", result?.safetyChecks || [], y, headerContext, (item) => ({
    title: item.title,
    subtitle: item.severity ? `${item.severity} priority flag` : "",
    body: item.detail
  }));

  y = drawObjectCards(doc, "Selected nearby care", (result?.nearbyHospitals || []).slice(0, 3), y, headerContext, (item) => ({
    title: item.name,
    subtitle: [item.type, Number.isFinite(item.distanceKm) ? `${item.distanceKm.toFixed(1)} km away` : ""]
      .filter(Boolean)
      .join(" | "),
    body: item.address || item.area || "",
    footer: typeof item.suitabilityScore === "number" ? `Suitability score ${item.suitabilityScore}` : "",
    linkLabel: item.mapUrl ? "Open route in Google Maps" : "",
    linkUrl: item.mapUrl || ""
  }));

  drawParagraphCard(
    doc,
    "Clinical note",
    "This summary is prepared from patient-entered information, optional image context, and PulsePath decision-support logic. It should support, not replace, direct clinical evaluation.",
    y,
    headerContext
  );
  addFooters(doc, `${BRAND_NAME} handoff document for clinical review.`);
  doc.save(`${sanitizeFileName(profile?.displayName || "pulsepath")}-doctor-handoff.pdf`);
}

export async function downloadEmergencyCardPdf(profile) {
  const card = buildEmergencyCard(profile);
  const doc = createDoc("Offline Emergency Card");
  const logoDataUrl = await getBrandLogoDataUrl();
  const generatedAt = formatDocumentTime();
  const headerContext = {
    title: "Offline Emergency Card",
    subtitle: "Quick medical identity and emergency contact information stored locally in PulsePath.",
    generatedAt,
    urgencyLevel: "Emergency",
    logoDataUrl
  };
  let y = drawHeader(doc, headerContext);

  y = drawParagraphCard(
    doc,
    "Emergency use",
    "Use this card when you need to quickly share core medical details with emergency responders, ambulance staff, or hospital intake teams.",
    y,
    headerContext
  );

  y = drawFieldGrid(
    doc,
    [
      { label: "Patient", value: card.displayName },
      { label: "Age / Gender", value: `${card.age} / ${card.gender}` },
      { label: "Blood group", value: card.bloodGroup },
      { label: "Emergency contact", value: card.emergencyContactName },
      { label: "Relation", value: card.emergencyContactRelation },
      { label: "Phone", value: card.emergencyContactPhone }
    ],
    y,
    headerContext
  );

  y = drawObjectCards(
    doc,
    "Medical essentials",
    [
      { title: "Allergies", body: card.allergies },
      { title: "Current medicines", body: card.currentMedicines },
      { title: "Chronic conditions", body: card.chronicConditions },
      { title: "Additional notes", body: card.notes }
    ],
    y,
    headerContext
  );

  drawParagraphCard(
    doc,
    "Storage note",
    "This emergency card is generated from information stored locally on this device inside the PulsePath PWA.",
    y,
    headerContext
  );
  addFooters(doc, `${BRAND_NAME} offline emergency card.`);
  doc.save(`${sanitizeFileName(profile?.displayName || "pulsepath")}-emergency-card.pdf`);
}

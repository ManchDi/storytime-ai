import jsPDF from 'jspdf';
import { StoryPage, StoryConfig } from '../types';

const PAGE_W = 148;
const PAGE_H = 210;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PURPLE_R = 124, PURPLE_G = 58, PURPLE_B = 237;
const GRAY_R = 75, GRAY_G = 85, GRAY_B = 99;

async function drawImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number
): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      doc.addImage(dataUrl, 'PNG', x + (maxW - w) / 2, y, w, h);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
}

// Draw decorative dots instead of emoji stars
function drawDots(doc: jsPDF, y: number) {
  const cx = PAGE_W / 2;
  const positions = [-16, -8, 0, 8, 16];
  positions.forEach((offset, i) => {
    const size = i === 2 ? 1.8 : 1.2;
    doc.setFillColor(255, 255, 255);
    doc.circle(cx + offset, y, size, 'F');
  });
}

function drawCoverPage(doc: jsPDF, config: StoryConfig) {
  const cx = PAGE_W / 2;

  // Background
  doc.setFillColor(243, 232, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Top band
  doc.setFillColor(PURPLE_R, PURPLE_G, PURPLE_B);
  doc.rect(0, 0, PAGE_W, 20, 'F');

  // "Pagekin" text in top band
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Pagekin', cx, 13, { align: 'center' });

  // Dots in top band
  drawDots(doc, 13);

  // Title
  doc.setTextColor(PURPLE_R, PURPLE_G, PURPLE_B);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  const titleText = config.childName && config.includeChild
    ? `${config.childName}'s Story`
    : 'A Magical Story';
  doc.text(titleText, cx, 62, { align: 'center' });

  // Divider line
  doc.setDrawColor(PURPLE_R, PURPLE_G, PURPLE_B);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 15, 68, PAGE_W - MARGIN - 15, 68);

  // Theme
  doc.setFontSize(11);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(GRAY_R, GRAY_G, GRAY_B);
  const themeLines = doc.splitTextToSize(`"${config.theme}"`, CONTENT_W - 8);
  doc.text(themeLines, cx, 80, { align: 'center' });

  // Age label
  const ageLabel: Record<string, string> = {
    '2-4': 'For little ones aged 2-4',
    '5-7': 'For readers aged 5-7',
    '8-10': 'For readers aged 8-10',
  };
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 139, 250);
  doc.text(ageLabel[config.ageRange] ?? '', cx, 100, { align: 'center' });

  // Decorative circle in center of page
  doc.setFillColor(216, 180, 254);
  doc.circle(cx, 148, 18, 'F');
  doc.setFillColor(PURPLE_R, PURPLE_G, PURPLE_B);
  doc.circle(cx, 148, 12, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, 148, 5, 'F');

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  doc.text(`Created with Pagekin · ${date}`, cx, PAGE_H - 7, { align: 'center' });
}

async function drawStoryPage(
  doc: jsPDF,
  page: StoryPage,
  pageIndex: number,
  totalPages: number
) {
  const cx = PAGE_W / 2;
  const imageAreaH = PAGE_H * 0.52;

  // Background
  doc.setFillColor(252, 250, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Image area background
  doc.setFillColor(237, 233, 254);
  doc.roundedRect(MARGIN, MARGIN, CONTENT_W, imageAreaH, 4, 4, 'F');

  if (page.imageUrl) {
    await drawImage(doc, page.imageUrl, MARGIN, MARGIN, CONTENT_W, imageAreaH);
  }

  // Story text
  const textY = MARGIN + imageAreaH + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GRAY_R, GRAY_G, GRAY_B);
  const lines = doc.splitTextToSize(page.text, CONTENT_W);
  doc.text(lines, MARGIN, textY);

  // Page number
  doc.setFontSize(9);
  doc.setTextColor(167, 139, 250);
  doc.text(`${pageIndex + 1} / ${totalPages}`, cx, PAGE_H - 6, { align: 'center' });
}

export async function generateStoryPDF(
  pages: StoryPage[],
  config: StoryConfig
): Promise<void> {
  // Only include pages that are fully ready: have text, have image, not still generating
  const readyPages = pages.filter(p => p.text && p.imageUrl && !p.isGenerating);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  drawCoverPage(doc, config);

  for (let i = 0; i < readyPages.length; i++) {
    doc.addPage();
    await drawStoryPage(doc, readyPages[i], i, readyPages.length);
  }

  const filename = config.childName
    ? `${config.childName.toLowerCase().replace(/\s+/g, '-')}-story.pdf`
    : 'pagekin-story.pdf';

  doc.save(filename);
}
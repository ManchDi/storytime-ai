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
      doc.addImage(dataUrl, 'PNG', x + (maxW - w) / 2, y + (maxH - h) / 2, w, h);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
}

async function drawCoverPage(doc: jsPDF, config: StoryConfig, coverImageUrl?: string) {
  const cx = PAGE_W / 2;

  // Background
  doc.setFillColor(243, 232, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Top band
  doc.setFillColor(PURPLE_R, PURPLE_G, PURPLE_B);
  doc.rect(0, 0, PAGE_W, 20, 'F');

  // "Pagekin" text in top band — plain text, no emoji
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Pagekin', cx, 13, { align: 'center' });

  // Title
  doc.setTextColor(PURPLE_R, PURPLE_G, PURPLE_B);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  const titleText = config.childName && config.includeChild
    ? `${config.childName}'s Story`
    : 'A Magical Story';
  doc.text(titleText, cx, 42, { align: 'center' });

  // Divider
  doc.setDrawColor(PURPLE_R, PURPLE_G, PURPLE_B);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 15, 48, PAGE_W - MARGIN - 15, 48);

  // Theme
  doc.setFontSize(11);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(GRAY_R, GRAY_G, GRAY_B);
  const themeLines = doc.splitTextToSize(`"${config.theme}"`, CONTENT_W - 8);
  doc.text(themeLines, cx, 58, { align: 'center' });

  // Age label
  const ageLabel: Record<string, string> = {
    '2-4': 'For little ones aged 2-4',
    '5-7': 'For readers aged 5-7',
    '8-10': 'For readers aged 8-10',
  };
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 139, 250);
  doc.text(ageLabel[config.ageRange] ?? '', cx, 72, { align: 'center' });

  // Center image — first story illustration or fallback circle
  const imageY = 82;
  const imageH = 90;

  doc.setFillColor(216, 180, 254);
  doc.roundedRect(MARGIN, imageY, CONTENT_W, imageH, 5, 5, 'F');

  if (coverImageUrl) {
    await drawImage(doc, coverImageUrl, MARGIN, imageY, CONTENT_W, imageH);
  }

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
  // Only pages that are fully ready: have text, have image, not still generating
  const readyPages = pages.filter(p => p.text && !p.isGenerating);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  // Use first page's illustration as cover image
  const coverImageUrl = readyPages[0]?.imageUrl;
  await drawCoverPage(doc, config, coverImageUrl);

  for (let i = 0; i < readyPages.length; i++) {
    doc.addPage();
    await drawStoryPage(doc, readyPages[i], i, readyPages.length);
  }

  const filename = config.childName
    ? `${config.childName.toLowerCase().replace(/\s+/g, '-')}-story.pdf`
    : 'pagekin-story.pdf';

  doc.save(filename);
}
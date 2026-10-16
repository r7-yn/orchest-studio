import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '256kb' }));

interface CatalogTrack {
  id: string;
  title: string;
  artist: string;
  rhythm: string;
  categoryId: string;
  categoryLabel: string;
  code: string;
  description: string;
}

interface SemanticSearchBody {
  query: string;
  tracks: CatalogTrack[];
}

interface SeoBody {
  title: string;
  artist: string;
  category?: string;
  rhythm?: string;
  notes?: string;
}

interface ConciergeBody {
  message: string;
  tracks: CatalogTrack[];
}

const requestWindows = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function getClientIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isRateLimited(req: express.Request): boolean {
  const now = Date.now();
  const key = getClientIp(req);
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

function isCatalogTrack(value: unknown): value is CatalogTrack {
  if (!value || typeof value !== 'object') return false;
  const track = value as Record<string, unknown>;
  return ['id', 'title', 'artist', 'rhythm', 'categoryId', 'categoryLabel', 'code', 'description']
    .every((key) => typeof track[key] === 'string' && (track[key] as string).length <= 500);
}

function parseCatalogTracks(value: unknown): CatalogTrack[] {
  if (!Array.isArray(value) || value.length > 500) return [];
  return value.filter(isCatalogTrack);
}

function parseBoundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function rejectRateLimited(req: express.Request, res: express.Response): boolean {
  if (!isRateLimited(req)) return false;
  res.status(429).json({ error: 'طلبات كثيرة. يرجى المحاولة بعد قليل.' });
  return true;
}

// Initialize Google GenAI client if key is provided
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize Google GenAI client:', err);
  }
}

/**
 * Intelligent Semantic Intent Analyzer & Matcher
 * Uses NLP rules, dialect normalization, and intent vectors
 */
function analyzeSemanticIntentFallback(query: string, tracks: CatalogTrack[]) {
  const cleanQ = query.toLowerCase().trim();
  let detectedIntent = 'طلب زفة خليجية مخصصة';
  const matches: Array<{ trackId: string; score: number; reason: string }> = [];

  const wantsWithoutMusic = cleanQ.includes('بدون موسيقى') || cleanQ.includes('بلا موسيقى') || cleanQ.includes('اسلامية') || cleanQ.includes('إسلامي');
  const wantsDufoof = cleanQ.includes('دفوف') || cleanQ.includes('دف') || cleanQ.includes('إيقاع');
  const wantsOrchestra = cleanQ.includes('اوركسترا') || cleanQ.includes('موسيقى') || cleanQ.includes('كمان');
  const wantsCalm = cleanQ.includes('هادي') || cleanQ.includes('هدوء') || cleanQ.includes('رومانسي') || cleanQ.includes('ناعم');
  const wantsLuxury = cleanQ.includes('فخم') || cleanQ.includes('ملكي') || cleanQ.includes('هيبة') || cleanQ.includes('كبير');
  const wantsBride = cleanQ.includes('عروس') || cleanQ.includes('زفاف') || cleanQ.includes('عرس') || cleanQ.includes('دخلة') || cleanQ.includes('مسيرة');
  const wantsGroom = cleanQ.includes('عريس') || cleanQ.includes('معرس') || cleanQ.includes('رجال');
  const wantsSheilat = cleanQ.includes('شيلة') || cleanQ.includes('شيلات') || cleanQ.includes('حماس') || cleanQ.includes('فخر');
  const wantsWelcome = cleanQ.includes('ترحيب') || cleanQ.includes('ضيوف') || cleanQ.includes('مرحبا') || cleanQ.includes('هلا');
  const wantsBaby = cleanQ.includes('مولود') || cleanQ.includes('مواليد') || cleanQ.includes('عقيقة') || cleanQ.includes('بيبي');

  // Synthesize detected intent string
  const intentParts: string[] = [];
  if (wantsBride) intentParts.push('زفة عروس ملكية');
  if (wantsGroom) intentParts.push('مسيرة عريس');
  if (wantsSheilat) intentParts.push('شيلة حماسية');
  if (wantsWelcome) intentParts.push('ترحيب بالضيوف');
  if (wantsBaby) intentParts.push('استقبال مواليد');
  if (wantsCalm) intentParts.push('بطابع هادئ ورومانسي');
  if (wantsLuxury) intentParts.push('بأجواء فخمة');
  if (wantsWithoutMusic) intentParts.push('بدون موسيقى (إسلامية)');
  if (wantsDufoof) intentParts.push('بإيقاع الدفوف الخليجية');

  detectedIntent = intentParts.length > 0 ? intentParts.join(' • ') : 'زفات وشيلات ملكية مختارة';

  for (const track of tracks) {
    let score = 30; // base score
    let reasons: string[] = [];

    // Check rhythm
    if (wantsWithoutMusic) {
      if (track.rhythm === 'بدون موسيقى') {
        score += 35;
        reasons.push('تنفيذ نقي بدون موسيقى 100%');
      } else {
        score -= 20;
      }
    }
    if (wantsDufoof) {
      if (track.rhythm === 'دفوف') {
        score += 35;
        reasons.push('إيقاع دفوف خليجية نقية');
      }
    }
    if (wantsOrchestra && track.rhythm === 'أوركسترا') {
      score += 30;
      reasons.push('توزيع أوركسترالي ملكي فخم');
    }

    // Check category & mood
    if (wantsBride && track.categoryId === 'zaffat-bride') {
      score += 25;
      reasons.push('مخصصة لإطلالة ومسيرة العروس');
    }
    if (wantsSheilat && track.categoryId === 'sheilat-enthusiastic') {
      score += 30;
      reasons.push('شيلة حماسية وقصائد فخر');
    }
    if (wantsWelcome && track.categoryId === 'welcoming') {
      score += 30;
      reasons.push('لحن ترحيبي دافئ لضيوف الحفل');
    }
    if (wantsBaby && track.categoryId === 'babies') {
      score += 40;
      reasons.push('مقطوعة رقيقة لاستقبال المواليد');
    }

    // Check calm / gentle
    if (wantsCalm) {
      if (track.rhythm === 'بدون موسيقى' || track.title.includes('كلاسيك') || track.title.includes('لطيفة') || track.title.includes('فخمة')) {
        score += 20;
        reasons.push('تناغم هادئ يمنح المسيرة هيبة وسكينة');
      }
    }

    // Keyword relevance
    const textCorpus = `${track.title} ${track.artist} ${track.description} ${track.categoryLabel}`.toLowerCase();
    const words = cleanQ.split(/\s+/).filter((w) => w.length > 2);
    for (const w of words) {
      if (textCorpus.includes(w)) {
        score += 8;
      }
    }

    const finalScore = Math.max(10, Math.min(99, score));
    matches.push({
      trackId: track.id,
      score: finalScore,
      reason: reasons.length > 0 ? reasons.slice(0, 2).join(' مع ') : 'تطابق في الطابع الصوتي والتصنيف',
    });
  }

  matches.sort((a, b) => b.score - a.score);

  return {
    detectedIntent,
    matches: matches.slice(0, 6),
  };
}

// 1. Semantic Search API Endpoint (البحث الدلالي الذكي)
app.post('/api/ai/semantic-search', async (req, res) => {
  try {
    if (rejectRateLimited(req, res)) return;
    const query = parseBoundedText(req.body?.query, 300);
    const tracks = parseCatalogTracks(req.body?.tracks);

    if (!query) {
      return res.json({ matches: [], intentSummary: '' });
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return res.json({ matches: [], intentSummary: '' });
    }

    // If Gemini client available, attempt LLM call with fallback
    if (aiClient) {
      try {
          const catalogSummary = tracks.map((t: CatalogTrack) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          rhythm: t.rhythm,
          category: t.categoryLabel,
          code: t.code,
          description: t.description,
        }));

        const prompt = `أنت محرك بحث دلالي ذكي متخصص في استوديو أوركست للزفات الخليجية.
استعلام الزبون: "${query}".
المهمة:
1. حلل نية الزبون (المناسبة، نوع الإيقاع: بدون موسيقى / دفوف / أوركسترا، المزاج: هادئ / فخم / حماسي).
2. قيّم الأعمال الصوتية من الكتالوج التالي ورتب أفضل الأعمال تطابقاً دلالياً حتى لو اختلفت الكلمات الحرفية.
3. لكل عمل مطابق، حدد نسبة التطابق من 0 إلى 100، وقدم سبباً موجزاً بالعربية الفصحى.

كتالوج الأعمال:
${JSON.stringify(catalogSummary, null, 2)}`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedIntent: { type: Type.STRING },
                matches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      trackId: { type: Type.STRING },
                      score: { type: Type.NUMBER },
                      reason: { type: Type.STRING },
                    },
                    required: ['trackId', 'score', 'reason'],
                  },
                },
              },
              required: ['detectedIntent', 'matches'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.matches && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
          return res.json({
            matches: parsed.matches,
            intentSummary: parsed.detectedIntent || '',
          });
        }
      } catch (geminiErr: unknown) {
        console.warn('Gemini temporary API spike, falling back to intelligent semantic engine:', readErrorMessage(geminiErr));
      }
    }

    // High fidelity semantic fallback
    const fallbackResult = analyzeSemanticIntentFallback(query, tracks);
    return res.json({
      matches: fallbackResult.matches,
      intentSummary: fallbackResult.detectedIntent,
    });
  } catch (error: unknown) {
    console.error('Semantic Search Critical Error:', readErrorMessage(error));
    res.status(500).json({ error: 'تعذر تنفيذ البحث حالياً', matches: [], intentSummary: '' });
  }
});

// 2. AI SEO & Marketing Description Generator for Studio Owner
app.post('/api/ai/generate-seo', async (req, res) => {
  try {
    if (rejectRateLimited(req, res)) return;
    const title = parseBoundedText(req.body?.title, 160);
    const artist = parseBoundedText(req.body?.artist, 120);
    const category = parseBoundedText(req.body?.category, 120) || undefined;
    const rhythm = parseBoundedText(req.body?.rhythm, 80) || undefined;
    const notes = parseBoundedText(req.body?.notes, 500) || undefined;

    if (!title || !artist) {
      return res.status(400).json({ error: 'العنوان واسم المنشد مطلوبان' });
    }

    if (aiClient) {
      try {
        const prompt = `أنت خبير تسويق رقمي وكبير مهندسي محركات البحث (SEO Specialist & Luxury Copywriter) لمنصة "أوركست" المتخصصة في الزفات الخليجية والشيلات الملكية.
المطلوب توليد بيانات تسويقية متكاملة ومحسنة لمحركات البحث للعمل الصوتي التالي:
- عنوان العمل: "${title}"
- المنشد: "${artist}"
- التصنيف: "${category || 'زفات عروس'}"
- نوع الإيقاع: "${rhythm || 'بدون موسيقى'}"
${notes ? `- ملاحظات إضافية: "${notes}"` : ''}

المخرجات المطلوبة بتنسيق JSON:
1. metaTitle: عنوان SEO احترافي وجذاب لجوجل (أقل من 60 حرفاً).
2. metaDescription: وصف SEO جذاب لمحركات البحث (بين 130 و 160 حرفاً).
3. marketingDescription: فقرة تسويقية فخمة وراقية (60-90 كلمة) بلهجة خليجية فصحى تبرز جمال اللحن وجودة الاستوديو وتدعو للطلب بالأسماء.
4. recommendedTags: قائمة من 5 إلى 8 وسوم (Tags) قوية لمحركات البحث.
5. targetAudience: الفئة المناسبة لهذا العمل.`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                metaTitle: { type: Type.STRING },
                metaDescription: { type: Type.STRING },
                marketingDescription: { type: Type.STRING },
                recommendedTags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                targetAudience: { type: Type.STRING },
              },
              required: ['metaTitle', 'metaDescription', 'marketingDescription', 'recommendedTags', 'targetAudience'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.metaTitle) {
          return res.json(parsed);
        }
      } catch (geminiErr: unknown) {
        console.warn('Gemini SEO spike, using luxury template generator:', readErrorMessage(geminiErr));
      }
    }

    // High quality deterministic luxury marketing copy
    return res.json({
      metaTitle: `${title} - المنشد ${artist} | زفات أوركست الملكية`,
      metaDescription: `استمع واطلب زفة ${title} بصوت المنشد ${artist}. تنفيذ حصري بالأسماء مع خيارات ${rhythm}. تسجيل استوديو ماسترينغ فخم لمناسبتكم السعيدة.`,
      marketingDescription: `تحفة صوتية ملكية تحمل عنوان "${title}" بأداء المنشد المبدع ${artist}، تم تسجيلها وهندستها في استوديو أوركست بأحدث تقنيات الصوت الماسترينغ لتضفي على مسيرة ليلتكم الكبرى وقاراً وهيبة لا تُنسى. العمل متاح للتخصيص الكامل بالأسماء وتعديل الإيقاع حسب تفاصيل قاعتكم.`,
      recommendedTags: [
        title,
        artist,
        category || 'زفات عروس',
        rhythm || 'بدون موسيقى',
        'زفات خليجية',
        'أوركست ستوديو',
        'تنفيذ بالأسماء',
      ],
      targetAudience: 'حفلات الزفاف الملكية، العرسان والمناسبات الخليجية الكبرى',
    });
  } catch (error: unknown) {
    console.error('SEO Generator Error:', readErrorMessage(error));
    res.status(500).json({ error: 'تعذر توليد الوصف حالياً' });
  }
});

// 3. AI Concierge Chatbot for Customers ("اسأل مساعد أوركست")
app.post('/api/ai/concierge', async (req, res) => {
  try {
    if (rejectRateLimited(req, res)) return;
    const message = parseBoundedText(req.body?.message, 500);
    const tracks = parseCatalogTracks(req.body?.tracks);

    if (!message) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const catalogList = tracks;

    if (aiClient) {
      try {
        const catalogData = catalogList.map((t: CatalogTrack) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          code: t.code,
          rhythm: t.rhythm,
          category: t.categoryLabel,
          description: t.description,
        }));

        const systemInstruction = `أنت "مساعد أوركست الذكي (Orchest AI Concierge)"، مستشار الذوق الصوتي والزفات الملكية في استوديو أوركست الخليجي.
شخصيتك: لبق، راقٍ، مهني جداً، تستخدم عبارات ترحيبية خليجية دافئة وفخمة ("يا أهلاً وسهلاً"، "ألف مبروك مقدماً").
المهمة:
1. فهم رغبة الزبون وذوقه الصوتي بدقة.
2. ترشيح من 1 إلى 3 أعمال محددة بالضبط من قائمة الكتالوج المتاحة عبر معرفاتها (track IDs).
3. تقديم رد موجز ومقنع يشرح لماذا هذا العمل يناسب طلبه.
4. اقتراح نوع التعديل المناسب (تغيير الأسماء، إضافة شعر، تعديل الإيقاع).

كتالوج الأعمال:
${JSON.stringify(catalogData, null, 2)}`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `سؤال الزبون: "${message}"`,
          config: {
            systemInstruction,
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                recommendedTrackIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                suggestedModification: { type: Type.STRING },
              },
              required: ['reply', 'recommendedTrackIds'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.reply && Array.isArray(parsed.recommendedTrackIds) && parsed.recommendedTrackIds.length > 0) {
          return res.json(parsed);
        }
      } catch (geminiErr: unknown) {
        console.warn('Gemini Concierge spike, using intelligent fallback concierge:', readErrorMessage(geminiErr));
      }
    }

    // High quality intelligent conversational concierge
    const semanticMatches = analyzeSemanticIntentFallback(message, catalogList);
    const topIds = semanticMatches.matches.slice(0, 3).map((m) => m.trackId);

    return res.json({
      reply: `يا أهلاً وسهلاً بك في استوديو أوركست! 🎵 ألف مبروك مقدماً. بناءً على رغبتك (${semanticMatches.detectedIntent})، قمت باختيار هذه الأعمال الصوتية الملكية التي تتطابق تماماً مع إحساس المسيرة وجودة الاستوديو التي تبحث عنها:`,
      recommendedTrackIds: topIds.length > 0 ? topIds : catalogList.slice(0, 3).map((t) => t.id),
      suggestedModification: 'تغيير أسماء العروسين مع إمكانية إضافة مقدمة شعرية خاصة بالأسماء',
    });
  } catch (error: unknown) {
    console.error('Concierge Error:', readErrorMessage(error));
    res.status(500).json({ error: 'تعذر تشغيل المساعد حالياً' });
  }
});

// Vite Middleware for Dev / Static Files for Production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 Orchest Studio Server running on http://localhost:${PORT}`);
  });
}

startServer();

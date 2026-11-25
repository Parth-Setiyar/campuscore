import { GoogleGenAI, Type } from '@google/genai';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiUnavailableError(
      'Google Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets or enter remarks manually.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiUnavailableError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'GeminiUnavailableError';
    this.statusCode = statusCode;
  }
}

export interface RemarkGenerationInput {
  studentName: string;
  enrollmentNumber: string;
  subjectCode: string;
  subjectName: string;
  obtainedMarks: number;
  maxMarks: number;
  classAverage?: number | null;
  historicalSubjectAverage?: number | null;
  historicalOverallPercentage?: number | null;
}

export async function generateAcademicRemark(input: RemarkGenerationInput): Promise<string> {
  const ai = getGeminiClient();
  const percentage = ((input.obtainedMarks / input.maxMarks) * 100).toFixed(1);

  const historyLine =
    input.historicalOverallPercentage !== null && input.historicalOverallPercentage !== undefined
      ? `Previous published overall percentage: ${input.historicalOverallPercentage.toFixed(1)}%.`
      : 'No prior published semester record is available.';

  const prompt = [
    `Subject: ${input.subjectCode} — ${input.subjectName}`,
    `Marks Obtained: ${input.obtainedMarks} out of ${input.maxMarks} (${percentage}%)`,
    input.classAverage !== null && input.classAverage !== undefined
      ? `Class current average in this subject: ${input.classAverage.toFixed(1)} out of ${input.maxMarks}.`
      : '',
    historyLine,
    'Write a single concise, professional, constructive academic report card remark (1 to 2 sentences, max 35 words).',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an experienced college faculty academic advisor writing formal report card remarks. ' +
          'Be constructive, respectful, and strictly grounded in the provided numerical marks and historical percentages. ' +
          'Never insult or demotivate the student. Never invent personal traits, attendance, or behavioral observations that were not provided. ' +
          'Output only the final plain-text remark sentence(s) without quotes, markdown, or labels.',
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new GeminiUnavailableError('Gemini returned an empty response. Please try regenerating or enter a manual remark.');
    }
    return text.replace(/^["']|["']$/g, '').trim();
  } catch (err: unknown) {
    if (err instanceof GeminiUnavailableError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown Gemini API error';
    throw new GeminiUnavailableError(
      `Unable to reach Gemini AI service (${message}). You can retry or enter remarks manually.`,
      502
    );
  }
}

export interface StudentInsightInput {
  studentName: string;
  department: string;
  currentSemester: number;
  targetPercentage: number;
  semesterTrend: Array<{ semester: number; academicYear: string; percentage: number }>;
  subjectPerformance: Array<{
    subjectCode: string;
    subjectName: string;
    semester: number;
    obtainedMarks: number;
    maxMarks: number;
    percentage: number;
  }>;
  strongestSubjects: string[];
  weakestSubjects: string[];
  improvingTrendSummary: string;
}

export interface AiInsightsResult {
  executiveSummary: string;
  focusAreas: Array<{ area: string; rationale: string; actionStep: string }>;
  studyStrategy: string[];
  targetGuidance: string;
}

export async function generateStudentPerformanceInsights(input: StudentInsightInput): Promise<AiInsightsResult> {
  const ai = getGeminiClient();

  const prompt = JSON.stringify(
    {
      department: input.department,
      currentSemester: input.currentSemester,
      desiredTargetPercentage: input.targetPercentage,
      semesterTrend: input.semesterTrend,
      subjectPerformance: input.subjectPerformance,
      strongestSubjects: input.strongestSubjects,
      weakestSubjects: input.weakestSubjects,
      trendSummary: input.improvingTrendSummary,
    },
    null,
    2
  );

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        'Analyze the verified academic performance records below and produce structured, constructive academic focus guidance. ' +
        'Do not fabricate any scores, semesters, or behavioral claims.\n\n' +
        prompt,
      config: {
        systemInstruction:
          'You are an institutional academic advisor providing constructive study guidance to a university student based solely on their published marks. ' +
          'Keep advice concrete, subject-specific, encouraging, and grounded strictly in the provided data.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: '2-3 sentence constructive summary of academic progress based strictly on the provided marks.',
            },
            focusAreas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  area: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  actionStep: { type: Type.STRING },
                },
                required: ['area', 'rationale', 'actionStep'],
              },
            },
            studyStrategy: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            targetGuidance: {
              type: Type.STRING,
              description: 'Practical guidance on reaching the student chosen target percentage.',
            },
          },
          required: ['executiveSummary', 'focusAreas', 'studyStrategy', 'targetGuidance'],
        },
      },
    });

    const raw = response.text?.trim();
    if (!raw) {
      throw new GeminiUnavailableError('Gemini returned an empty insights response.');
    }
    return JSON.parse(raw) as AiInsightsResult;
  } catch (err: unknown) {
    if (err instanceof GeminiUnavailableError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown Gemini API error';
    throw new GeminiUnavailableError(
      `AI insights service is currently unavailable (${message}). Mathematical performance calculations remain fully available above.`,
      502
    );
  }
}

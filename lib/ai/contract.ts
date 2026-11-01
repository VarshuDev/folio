import { z } from 'zod';
import { ProjectSchema, TEMPLATE_IDS } from '../profile-schema';

/** Hard limits are shared by the server route, service, and tests. */
export const MAX_SOURCE_TEXT_CHARS = 8_000;
export const MAX_COPY_TEXT_CHARS = 3_000;
export const MAX_COPY_ALTERNATIVES = 3;
export const MAX_REQUEST_BODY_BYTES = 48 * 1024;
export const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
export const MAX_PROFILE_SUGGESTIONS = 30;
export const MAX_CLARIFYING_QUESTIONS = 5;
export const MAX_PROVENANCE_CHARS = 1_200;

/**
 * Exact, static paths only. Collections are proposed one item at a time;
 * originalNotes, schema/configuration fields, and arbitrary nested paths are
 * intentionally not writable through this contract.
 */
export const ALLOWED_PROFILE_PATHS = [
  'basics.name',
  'basics.role',
  'basics.about',
  'basics.location',
  'education.college',
  'education.degree',
  'education.branch',
  'education.gradYear',
  'education.note',
  'skills',
  'interests',
  'projects',
  'highlights',
  'activities',
  'learning',
  'links.email',
  'links.github',
  'links.linkedin',
  'links.other',
] as const;

export const AllowedProfilePathSchema = z.enum(ALLOWED_PROFILE_PATHS);
export type AllowedProfilePath = z.infer<typeof AllowedProfilePathSchema>;

const SourceTextSchema = z.string()
  .min(1)
  .max(MAX_SOURCE_TEXT_CHARS)
  .refine((value) => value.trim().length > 0, 'Source text cannot be blank.');

const CopyPathSchema = z.enum([
  'basics.role',
  'basics.about',
  'education.note',
  'projects',
  'highlights',
  'activities',
  'learning',
]);

export const COPY_IMPROVEMENT_ACTIONS = ['clearer', 'shorten', 'professional'] as const;
export const CopyImprovementActionSchema = z.enum(COPY_IMPROVEMENT_ACTIONS);
export type CopyImprovementAction = z.infer<typeof CopyImprovementActionSchema>;
export type ImproveCopyPath = 'basics.about' | `projects[${number}].description`;

export function isImproveCopyPath(value: unknown): value is ImproveCopyPath {
  if (value === 'basics.about') return true;
  if (typeof value !== 'string') return false;
  const match = /^projects\[(0|[1-9]\d*)\]\.description$/.exec(value);
  return Boolean(match && Number(match[1]) < 30);
}

export function projectIndexFromCopyPath(path: ImproveCopyPath): number | null {
  if (path === 'basics.about') return null;
  const match = /^projects\[(0|[1-9]\d*)\]\.description$/.exec(path);
  return match ? Number(match[1]) : null;
}

export const ImproveCopyPathSchema = z.custom<ImproveCopyPath>(isImproveCopyPath, 'Choose About or one project description.');
const CopyTextSchema = z.string().min(1).max(MAX_COPY_TEXT_CHARS).refine((value) => value.trim().length > 0, 'Copy text cannot be blank.');

/**
 * Requests contain only the selected field and the fields needed for one
 * operation. They never accept a whole draft, design config, or free-form path.
 */
export const AIRequestSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('extract_profile'), sourceText: SourceTextSchema }).strict(),
  z.object({ operation: z.literal('suggest_project'), sourceText: SourceTextSchema }).strict(),
  z.object({ operation: z.literal('improve_copy'), path: ImproveCopyPathSchema, text: CopyTextSchema, action: CopyImprovementActionSchema }).strict(),
  z.object({ operation: z.literal('suggest_sections'), sourceText: SourceTextSchema }).strict(),
  z.object({ operation: z.literal('adapt_copy_to_style'), selectedPath: CopyPathSchema, styleId: z.enum(TEMPLATE_IDS), sourceText: SourceTextSchema }).strict(),
  z.object({ operation: z.literal('ask_clarifying_question'), selectedPath: AllowedProfilePathSchema.optional(), sourceText: SourceTextSchema }).strict(),
]);
export type AIRequest = z.infer<typeof AIRequestSchema>;

export const SuggestionStatusSchema = z.enum(['suggested', 'accepted', 'edited', 'rejected', 'deferred']);
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ProvenanceSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('exact'), text: z.string().min(1).max(MAX_PROVENANCE_CHARS) }).strict(),
  z.object({ status: z.literal('unavailable') }).strict(),
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;

const NonBlankText = (max: number) => z.string().min(1).max(max).refine((value) => value.trim().length > 0);

export const ProjectProposalValueSchema = z.object({
  title: z.string().max(120),
  description: z.string().max(3_000),
  tools: z.string().max(240),
  link: z.string().max(500),
}).strict().superRefine((project, context) => {
  if (!project.title.trim() && !project.description.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A proposed project needs a title or description.' });
  }
  if (project.link.trim() && !isSafeExternalUrl(project.link)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['link'], message: 'Project links must use a safe HTTP or HTTPS URL.' });
  }
});

export const OtherLinkProposalValueSchema = z.object({
  label: NonBlankText(60),
  url: NonBlankText(500).refine(isSafeExternalUrl, 'Links must use a safe HTTP or HTTPS URL.'),
}).strict();

function isSafeExternalUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

const oneString = (max: number) => NonBlankText(max);
const safeUrl = (max: number) => NonBlankText(max).refine(isSafeExternalUrl, 'Links must use a safe HTTP or HTTPS URL.');

const proposalValueSchemas = new Map<AllowedProfilePath, z.ZodTypeAny>([
  ['basics.name', oneString(120)],
  ['basics.role', oneString(180)],
  ['basics.about', oneString(3_000)],
  ['basics.location', oneString(120)],
  ['education.college', oneString(180)],
  ['education.degree', oneString(120)],
  ['education.branch', oneString(120)],
  ['education.gradYear', oneString(12)],
  ['education.note', oneString(1_500)],
  ['skills', oneString(80)],
  ['interests', oneString(100)],
  // A project proposal deliberately omits its id; the application generates one.
  ['projects', ProjectProposalValueSchema],
  ['highlights', oneString(2_000)],
  ['activities', oneString(2_000)],
  ['learning', oneString(2_000)],
  ['links.email', z.string().min(1).max(254).email().refine((value) => value.trim().length > 0)],
  ['links.github', safeUrl(500)],
  ['links.linkedin', safeUrl(500)],
  // A single link item is proposed; it cannot replace or expand the collection wholesale.
  ['links.other', OtherLinkProposalValueSchema],
]);

export function validateProposalValue(path: AllowedProfilePath, value: unknown): z.SafeParseReturnType<unknown, unknown> {
  const schema = proposalValueSchemas.get(path);
  if (!schema) return { success: false, error: new z.ZodError([{ code: z.ZodIssueCode.custom, message: 'Unsupported profile path.', path: [] }]) };
  return schema.safeParse(value);
}

export const ProviderSuggestionSchema = z.object({
  path: AllowedProfilePathSchema,
  proposedValue: z.unknown(),
  provenance: ProvenanceSchema,
  reason: NonBlankText(400),
  confidence: ConfidenceSchema,
  needsReview: z.boolean(),
}).strict().superRefine((suggestion, context) => {
  if (!suggestion.needsReview) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['needsReview'], message: 'Every proposal must require human review.' });
  }
});
export type ProviderSuggestion = z.infer<typeof ProviderSuggestionSchema>;

export const ClarifyingQuestionSchema = z.object({
  question: NonBlankText(300),
  reason: NonBlankText(250),
  provenance: ProvenanceSchema,
}).strict();
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>;

/** Provider output is data only: no scripts, prompts, arbitrary paths, or status decisions. */
export const ProviderEnvelopeSchema = z.object({
  suggestions: z.array(ProviderSuggestionSchema).max(MAX_PROFILE_SUGGESTIONS),
  clarifyingQuestions: z.array(ClarifyingQuestionSchema).max(MAX_CLARIFYING_QUESTIONS),
}).strict();
export type ProviderEnvelope = z.infer<typeof ProviderEnvelopeSchema>;

/** Provider output for copy improvement must include a verbatim source excerpt. */
export const CopyProviderAlternativeSchema = z.object({
  proposedText: CopyTextSchema,
  sourceExcerpt: z.string().min(1).max(MAX_PROVENANCE_CHARS),
}).strict();
export type CopyProviderAlternative = z.infer<typeof CopyProviderAlternativeSchema>;

export const CopyProviderEnvelopeSchema = z.object({
  alternatives: z.array(CopyProviderAlternativeSchema).min(2).max(MAX_COPY_ALTERNATIVES),
}).strict();
export type CopyProviderEnvelope = z.infer<typeof CopyProviderEnvelopeSchema>;

export const ProfileSuggestionSchema = z.object({
  id: z.string().min(1).max(40),
  path: AllowedProfilePathSchema,
  proposedValue: z.unknown(),
  provenance: ProvenanceSchema,
  reason: NonBlankText(400),
  confidence: ConfidenceSchema,
  needsReview: z.literal(true),
  status: SuggestionStatusSchema,
}).strict();
export type ProfileSuggestion = z.infer<typeof ProfileSuggestionSchema>;

export const CopyImprovementProposalSchema = z.object({
  id: z.string().min(1).max(40),
  path: ImproveCopyPathSchema,
  originalText: CopyTextSchema,
  proposedText: CopyTextSchema,
  action: CopyImprovementActionSchema,
  provenance: z.object({ status: z.literal('exact'), text: z.string().min(1).max(MAX_PROVENANCE_CHARS) }).strict(),
  reason: NonBlankText(240),
  confidence: ConfidenceSchema,
  needsReview: z.literal(true),
  status: SuggestionStatusSchema,
}).strict();
export type CopyImprovementProposal = z.infer<typeof CopyImprovementProposalSchema>;

export const AIErrorCodeSchema = z.enum([
  'invalid_request',
  'request_too_large',
  'unsupported_operation',
  'unavailable',
  'timeout',
  'rate_limited',
  'provider_failure',
  'empty_response',
  'invalid_response',
]);
export type AIErrorCode = z.infer<typeof AIErrorCodeSchema>;

export const AISafeErrorSchema = z.object({
  code: AIErrorCodeSchema,
  message: z.string().min(1).max(300),
  retryable: z.boolean(),
}).strict();

export const AIServiceErrorSchema = z.object({ ok: z.literal(false), error: AISafeErrorSchema }).strict();
export type AIServiceError = z.infer<typeof AIServiceErrorSchema>;

const AIExtractProfileSuccessSchema = z.object({
  ok: z.literal(true),
  operation: z.literal('extract_profile'),
  mode: z.enum(['fixture', 'provider']),
  notice: z.string().max(160).optional(),
  fixtureCase: z.string().max(80).optional(),
  suggestions: z.array(ProfileSuggestionSchema).max(MAX_PROFILE_SUGGESTIONS),
  clarifyingQuestions: z.array(ClarifyingQuestionSchema).max(MAX_CLARIFYING_QUESTIONS),
}).strict();

const AIImproveCopySuccessSchema = z.object({
  ok: z.literal(true),
  operation: z.literal('improve_copy'),
  mode: z.literal('provider'),
  suggestions: z.array(CopyImprovementProposalSchema).min(2).max(MAX_COPY_ALTERNATIVES),
}).strict();

export const AIServiceSuccessSchema = z.discriminatedUnion('operation', [AIExtractProfileSuccessSchema, AIImproveCopySuccessSchema]);
export type AIServiceSuccess = z.infer<typeof AIServiceSuccessSchema>;

export const AIServiceResultSchema = z.union([AIServiceSuccessSchema, AIServiceErrorSchema]);
export type AIServiceResult = z.infer<typeof AIServiceResultSchema>;

export const MAX_SUGGESTIONS_PER_PATH: Readonly<Record<AllowedProfilePath, number>> = {
  'basics.name': 1,
  'basics.role': 1,
  'basics.about': 1,
  'basics.location': 1,
  'education.college': 1,
  'education.degree': 1,
  'education.branch': 1,
  'education.gradYear': 1,
  'education.note': 1,
  skills: 20,
  interests: 20,
  projects: 10,
  highlights: 10,
  activities: 10,
  learning: 1,
  'links.email': 1,
  'links.github': 1,
  'links.linkedin': 1,
  'links.other': 12,
};

/** Lõi gia sư 1-1 trên thiết bị (T16): API công khai. */

export { buildClipIndex, clipFromScore, clipTempoMap, clipTimeMap, handAnchor, noteBeats, noteHand, phraseOfTick, phrasesOf, pickPart } from './clip.ts';
export type { Click, Clip, ClipIndex, ExpectedNote, HandSwitch, IndexOptions, OnsetGroup, Phrase, RestSpan, SplitPoint, TwoHandOnset } from './clip.ts';
export { parseLessonConfig, parseSafetyParams, parseThresholds } from './config.ts';
export type { LessonConfig, SafetyParams, Thresholds } from './config.ts';
export {
  classifyContext,
  countSpokenSyllables,
  countTokens,
  fillCue,
  findBareTokens,
  isEligible,
  parseCueContextRules,
  parseCueLibrary,
  rankCues,
  selectAndFill,
  SLOT_SOURCE,
} from './cues.ts';
export type { CueContextRules, CueEntry, CueLibrary, CuePhase, CueRequest, FillOptions, FillResult } from './cues.ts';
export { runPianoDetectors } from './detectors.ts';
export type { DetectorInput } from './detectors.ts';
export { ScoreFollower } from './follower.ts';
export type { ExtraNote, FollowerConfig, HotEvent, NoteMatch, PlayedNote } from './follower.ts';
export {
  checkInvariants,
  checkLevelRules,
  cutBars,
  genDescendCheck,
  genHandsSplit,
  genLoop,
  genSlow,
  genSplit,
  genSubdivide,
  genTempoLadder,
  planBreathSplits,
  saoSlowLimits,
  scaleTempo,
} from './gen.ts';
export type { LevelIssue, SaoSlowLimits, SlowResult } from './gen.ts';
export { DataError, lessonCodeOf, parsePracticeTargets, parseSkillNode, parseVocaScore, targetsFromPart } from './load.ts';
export { isBlackKey, noteLabel, spokenNoteName } from './notes.ts';
export { confirmSelfAssessment, FeedbackPolicy, LADDER } from './policy.ts';
export type { AttemptOutcome, FeedbackItem, LadderStep, PlannedAction } from './policy.ts';
export { TutorSession } from './session.ts';
export * from './mic/index.ts';
export { buildErrorDrill } from './drill.ts';
export type { DrillTarget, ErrorDrill } from './drill.ts';
export { createInstrumentAudio } from './audio/sampler.ts';
export type { InstrumentAudio } from './audio/sampler.ts';
export type { AttemptReport, SessionOptions, Spoken, TutorData } from './session.ts';
export { barOfTick, barStartTick, buildTimeMap, msToTick, tickToMs } from './timing.ts';
export type { TimeMap } from './timing.ts';
export { PIANO_MIDI_ERROR_CODES, SLOT_NAMES } from './types.ts';
export type {
  Aspect,
  ClockMode,
  Detection,
  Hand,
  MidiEvent,
  PracticeMode,
  PracticeTarget,
  ScoreNote,
  ScorePart,
  SkillNodeRef,
  SlotFacts,
  SlotName,
  SlotValue,
  VocaScore,
} from './types.ts';

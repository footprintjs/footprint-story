/** The reader's bounds: lines of an answer, characters of a value or a name, bytes of a record, steps, and rows and keys read a step keeps. */
export const WHY_LIMITS: Readonly<{ lines: number; value: number; asked: number; bytes: number; steps: number; rows: number; reads: number }>;
/** Which decision let which step run, as plain data: {step: {deciderId, label?}}. */
export type ControlEdges = Readonly<Record<string, { readonly deciderId: string; readonly label?: string }>>;
/**
 * Which decision let each step of a run go, to save beside its record. `commitLog`: executor.getSnapshot().commitLog;
 * `control`: footprintjs/trace · controlDepRecorder(), attached to that run.
 */
export function controlEdges(commitLog: readonly { readonly runtimeStageId: string }[], control: { lookup(runtimeStageId: string): { deciderId?: string; label?: string } | undefined }): ControlEdges;
/**
 * Why `key` is what it is in a run, from the run's record file alone: its value, the stage that wrote it, the decision
 * that let that stage run and what each had read, walked back — text, every line one line. The record is read as a file
 * anyone may have written (a plain file within WHY_LIMITS, one run, names made one line); one that is not whole says
 * so first. Rejects, in words, for a key that is no value's name, a missing record, and a record that was changed.
 */
export function whyFromRecord(options: { file: string; key: string; control?: ControlEdges | null; run?: string; listed?: string | null; all?: boolean; more?: string | null }): Promise<string>;

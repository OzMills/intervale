export const FAKE_ACTIVITY_ID = 'activity.test';
export const FAKE_TOOL_ID = 'test.tool.rope';

export const FAKE_EVENT_IDS = ['event.test.common', 'event.test.tool', 'event.test.story'] as const;

export type FakeEventId = (typeof FAKE_EVENT_IDS)[number];

export const FAKE_CONTENT_IDS = new Set<string>([
  FAKE_ACTIVITY_ID,
  FAKE_TOOL_ID,
  ...FAKE_EVENT_IDS,
]);

export function isFakeContentId(value: string): boolean {
  return FAKE_CONTENT_IDS.has(value);
}

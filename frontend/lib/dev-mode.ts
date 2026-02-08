export const SHOW_TECHNICAL_COPY = process.env.NEXT_PUBLIC_DEV_TECH_MODE === "1";

export function audienceCopy(userCopy: string, technicalCopy: string): string {
  return SHOW_TECHNICAL_COPY ? technicalCopy : userCopy;
}

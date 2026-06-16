// Centralized lesson data loader
// Maps lesson IDs to their data modules

import type { LessonData } from "@/hooks/useGenericLesson";

// Import all lesson data modules
import * as lesson1Data from "./lesson1-earning-money";
import * as lesson3Data from "./lesson3-wants-needs";
import * as lesson4Data from "./lesson4-saving-investing";
import * as lesson5Data from "./lesson5-advertising";
import * as lesson6Data from "./lesson6-college";
import * as lesson7Data from "./lesson7-insurance";
import * as lesson8Data from "./lesson8-budgeting";
import * as lesson9Data from "./lesson9-banking";
import * as lesson10Data from "./lesson10-take-home-pay";
import * as lesson11Data from "./lesson11-financial-decisions";
import * as lesson12Data from "./lesson12-credit-score";
import * as lesson13Data from "./lesson13-consumer-privacy";
import * as lesson14Data from "./lesson14-using-credit";

// Helper to normalize lesson data format
const createLessonData = (data: {
  lessonIntroduction: string;
  preTestIntro: string;
  preTest: any[];
  preTestComplete: string;
  topics: any[];
  postTestIntro: string;
  postTest: any[];
  lessonCompletion: string;
}): LessonData => ({
  lessonIntroduction: data.lessonIntroduction,
  preTestIntro: data.preTestIntro,
  preTest: data.preTest,
  preTestComplete: data.preTestComplete,
  topics: data.topics,
  postTestIntro: data.postTestIntro,
  postTest: data.postTest,
  lessonCompletion: data.lessonCompletion,
});

// Lesson data registry - IDs must match lessons.ts
export const lessonDataMap: Record<string, LessonData> = {
  "earning-money": createLessonData(lesson1Data),
  "understanding-wants-needs": createLessonData(lesson3Data),
  "saving-investing": createLessonData(lesson4Data),
  "influence-of-advertising": createLessonData(lesson5Data),
  "cost-of-college": createLessonData(lesson6Data),
  "protecting-insuring": createLessonData(lesson7Data),
  "art-of-budgeting": createLessonData(lesson8Data),
  "understanding-banking": createLessonData(lesson9Data),
  "take-home-pay": createLessonData(lesson10Data),
  "financial-decisions": createLessonData(lesson11Data),
  "credit-score": createLessonData(lesson12Data),
  "consumer-privacy": createLessonData(lesson13Data),
  "using-credit": createLessonData(lesson14Data),
};

export const getLessonData = (lessonId: string): LessonData | null => {
  return lessonDataMap[lessonId] || null;
};

// List of lessons that use the generic hook (not Lesson 1 or 2)
export const genericLessonIds = [
  "earning-money",
  "understanding-wants-needs",
  "saving-investing",
  "influence-of-advertising",
  "cost-of-college",
  "protecting-insuring",
  "art-of-budgeting",
  "understanding-banking",
  "take-home-pay",
  "financial-decisions",
  "credit-score",
  "consumer-privacy",
  "using-credit",
];

export const isGenericLesson = (lessonId: string): boolean => {
  return genericLessonIds.includes(lessonId);
};
